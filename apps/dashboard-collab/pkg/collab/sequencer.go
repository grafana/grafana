package collab

import (
	"encoding/json"
	"errors"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana/apps/dashboard-collab/pkg/protocol"
)

var (
	// ErrLockRequired is returned when an op targets a panel the user has not locked.
	ErrLockRequired = errors.New("lock required: user does not hold lock on target")
	// ErrLockDenied is returned when a lock acquire is denied (held by another user).
	ErrLockDenied = errors.New("lock denied: target is locked by another user")
	// ErrUnknownMessageKind is returned for unrecognized message kinds.
	ErrUnknownMessageKind = errors.New("unknown message kind")
	// ErrInvalidPayload is returned when the message payload cannot be parsed.
	ErrInvalidPayload = errors.New("invalid message payload")
)

// ProcessClientMessage routes a client message to the appropriate handler,
// assigns a sequence number, and returns a ServerMessage for broadcast.
// The server is payload-agnostic — it never inspects mutation.type or mutation.payload.
func (s *Session) ProcessClientMessage(msg protocol.ClientMessage, userId string) (*protocol.ServerMessage, error) {
	switch msg.Kind {
	case protocol.MessageKindOp:
		return s.processOp(msg, userId)
	case protocol.MessageKindLock:
		return s.processLock(msg, userId)
	case protocol.MessageKindCheckpoint:
		return s.processCheckpoint(msg, userId)
	default:
		return nil, ErrUnknownMessageKind
	}
}

// processOp handles "op" messages. Verifies lock ownership if lockTarget is set,
// assigns a sequence number, and records the operation time.
func (s *Session) processOp(msg protocol.ClientMessage, userId string) (*protocol.ServerMessage, error) {
	var op protocol.CollabOperation
	if err := json.Unmarshal(msg.Op, &op); err != nil {
		return nil, ErrInvalidPayload
	}

	// Lock validation: if lockTarget is non-empty, user must hold that lock.
	if op.LockTarget != "" {
		snap := s.LockTable.Snapshot()
		if holder, ok := snap[op.LockTarget]; !ok || holder != userId {
			return nil, ErrLockRequired
		}
	}

	seq := atomic.AddInt64(&s.Seq, 1)

	s.mu.Lock()
	s.LastOpTime = time.Now()
	s.mu.Unlock()

	return &protocol.ServerMessage{
		Seq:       seq,
		Kind:      protocol.MessageKindOp,
		Op:        msg.Op,
		UserID:    userId,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

// processLock handles "lock" messages (acquire/release).
func (s *Session) processLock(msg protocol.ClientMessage, userId string) (*protocol.ServerMessage, error) {
	var lockOp protocol.LockOperation
	if err := json.Unmarshal(msg.Op, &lockOp); err != nil {
		return nil, ErrInvalidPayload
	}

	switch lockOp.Type {
	case protocol.LockTypeAcquire:
		granted, holder := s.LockTable.Acquire(lockOp.Target, userId)
		if !granted {
			return nil, errors.Join(ErrLockDenied, errors.New("held by "+holder))
		}
	case protocol.LockTypeRelease:
		s.LockTable.Release(lockOp.Target, userId)
	default:
		return nil, ErrInvalidPayload
	}

	seq := atomic.AddInt64(&s.Seq, 1)

	// Re-serialize the lock op with the userId to ensure consistency.
	lockOp.UserID = userId
	opBytes, err := json.Marshal(lockOp)
	if err != nil {
		return nil, err
	}

	return &protocol.ServerMessage{
		Seq:       seq,
		Kind:      protocol.MessageKindLock,
		Op:        opBytes,
		UserID:    userId,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

// processCheckpoint handles "checkpoint" messages (manual save trigger).
func (s *Session) processCheckpoint(msg protocol.ClientMessage, userId string) (*protocol.ServerMessage, error) {
	var checkpoint protocol.CheckpointOperation
	if err := json.Unmarshal(msg.Op, &checkpoint); err != nil {
		return nil, ErrInvalidPayload
	}

	seq := atomic.AddInt64(&s.Seq, 1)

	s.mu.Lock()
	s.LastOpTime = time.Now()
	s.mu.Unlock()

	return &protocol.ServerMessage{
		Seq:       seq,
		Kind:      protocol.MessageKindCheckpoint,
		Op:        msg.Op,
		UserID:    userId,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}
