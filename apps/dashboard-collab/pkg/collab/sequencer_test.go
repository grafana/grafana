package collab

import (
	"encoding/json"
	"sync"
	"testing"

	"github.com/grafana/grafana/apps/dashboard-collab/pkg/protocol"
	"github.com/stretchr/testify/require"
)

func newTestSession() *Session {
	return &Session{
		DashboardUID: "dash-1",
		Namespace:    "default",
		Users:        make(map[string]*UserState),
		LockTable:    NewLockTable(),
	}
}

func makeOpMessage(lockTarget string) protocol.ClientMessage {
	op := protocol.CollabOperation{
		Mutation: protocol.MutationRequest{
			Type:    "UPDATE_PANEL",
			Payload: json.RawMessage(`{"title":"New Title"}`),
		},
		LockTarget: lockTarget,
	}
	opBytes, _ := json.Marshal(op)
	return protocol.ClientMessage{
		Kind: protocol.MessageKindOp,
		Op:   opBytes,
	}
}

func makeLockMessage(lockType protocol.LockType, target string) protocol.ClientMessage {
	lockOp := protocol.LockOperation{
		Type:   lockType,
		Target: target,
	}
	opBytes, _ := json.Marshal(lockOp)
	return protocol.ClientMessage{
		Kind: protocol.MessageKindLock,
		Op:   opBytes,
	}
}

func makeCheckpointMessage(message string) protocol.ClientMessage {
	cp := protocol.CheckpointOperation{
		Type:    "checkpoint",
		Message: message,
	}
	opBytes, _ := json.Marshal(cp)
	return protocol.ClientMessage{
		Kind: protocol.MessageKindCheckpoint,
		Op:   opBytes,
	}
}

func TestProcessOpWithLock(t *testing.T) {
	s := newTestSession()
	s.LockTable.Acquire("panel-1", "alice")

	msg := makeOpMessage("panel-1")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.Equal(t, protocol.MessageKindOp, resp.Kind)
	require.Equal(t, "alice", resp.UserID)
	require.Equal(t, int64(1), resp.Seq)
	require.NotZero(t, resp.Timestamp)
}

func TestProcessOpWithoutRequiredLock(t *testing.T) {
	s := newTestSession()

	// No lock acquired, but op targets a panel.
	msg := makeOpMessage("panel-1")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.ErrorIs(t, err, ErrLockRequired)
	require.Nil(t, resp)
}

func TestProcessOpWithWrongLockHolder(t *testing.T) {
	s := newTestSession()
	s.LockTable.Acquire("panel-1", "bob")

	msg := makeOpMessage("panel-1")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.ErrorIs(t, err, ErrLockRequired)
	require.Nil(t, resp)
}

func TestProcessOpEmptyLockTarget(t *testing.T) {
	s := newTestSession()

	// Empty lockTarget means no lock required.
	msg := makeOpMessage("")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.Equal(t, int64(1), resp.Seq)
}

func TestProcessLockAcquire(t *testing.T) {
	s := newTestSession()

	msg := makeLockMessage(protocol.LockTypeAcquire, "panel-1")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)
	require.Equal(t, protocol.MessageKindLock, resp.Kind)
	require.Equal(t, "alice", resp.UserID)

	// Verify lock is held.
	snap := s.LockTable.Snapshot()
	require.Equal(t, "alice", snap["panel-1"])
}

func TestProcessLockAcquireDenied(t *testing.T) {
	s := newTestSession()
	s.LockTable.Acquire("panel-1", "bob")

	msg := makeLockMessage(protocol.LockTypeAcquire, "panel-1")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.ErrorIs(t, err, ErrLockDenied)
	require.Nil(t, resp)
}

func TestProcessLockRelease(t *testing.T) {
	s := newTestSession()
	s.LockTable.Acquire("panel-1", "alice")

	msg := makeLockMessage(protocol.LockTypeRelease, "panel-1")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)
	require.Equal(t, protocol.MessageKindLock, resp.Kind)

	// Verify lock is released.
	snap := s.LockTable.Snapshot()
	require.Empty(t, snap)
}

func TestProcessCheckpoint(t *testing.T) {
	s := newTestSession()

	msg := makeCheckpointMessage("Before deploy v2.1")
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)
	require.Equal(t, protocol.MessageKindCheckpoint, resp.Kind)
	require.Equal(t, "alice", resp.UserID)
	require.Equal(t, int64(1), resp.Seq)
}

func TestUnknownMessageKind(t *testing.T) {
	s := newTestSession()

	msg := protocol.ClientMessage{
		Kind: "unknown",
		Op:   json.RawMessage(`{}`),
	}
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.ErrorIs(t, err, ErrUnknownMessageKind)
	require.Nil(t, resp)
}

func TestSequenceNumbersMonotonic(t *testing.T) {
	s := newTestSession()

	for i := range 10 {
		msg := makeOpMessage("") // no lock required
		resp, err := s.ProcessClientMessage(msg, "alice")
		require.NoError(t, err)
		require.Equal(t, int64(i+1), resp.Seq)
	}
}

func TestSequenceNumbersMonotonicConcurrent(t *testing.T) {
	s := newTestSession()
	var wg sync.WaitGroup
	seqs := make(chan int64, 50)

	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			msg := makeOpMessage("") // no lock required
			resp, err := s.ProcessClientMessage(msg, "alice")
			if err == nil {
				seqs <- resp.Seq
			}
		}()
	}

	wg.Wait()
	close(seqs)

	// Collect all sequence numbers.
	seen := make(map[int64]bool)
	var maxSeq int64
	for seq := range seqs {
		require.False(t, seen[seq], "duplicate seq: %d", seq)
		seen[seq] = true
		if seq > maxSeq {
			maxSeq = seq
		}
	}

	// All 50 ops should have unique, contiguous sequence numbers.
	require.Len(t, seen, 50)
	require.Equal(t, int64(50), maxSeq)
}

func TestServerPayloadAgnostic(t *testing.T) {
	s := newTestSession()

	// The server should not care about mutation.type or mutation.payload content.
	// Use an arbitrary payload that would fail if parsed.
	op := protocol.CollabOperation{
		Mutation: protocol.MutationRequest{
			Type:    "SOME_UNKNOWN_TYPE",
			Payload: json.RawMessage(`{"arbitrary": [1, 2, "three"], "nested": {"deep": true}}`),
		},
		LockTarget: "",
	}
	opBytes, _ := json.Marshal(op)
	msg := protocol.ClientMessage{
		Kind: protocol.MessageKindOp,
		Op:   opBytes,
	}

	resp, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)
	require.NotNil(t, resp)

	// The op payload is passed through untouched.
	require.JSONEq(t, string(opBytes), string(resp.Op))
}

func TestLastOpTimeUpdated(t *testing.T) {
	s := newTestSession()

	require.True(t, s.LastOpTime.IsZero())

	msg := makeOpMessage("")
	_, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)

	s.mu.RLock()
	require.False(t, s.LastOpTime.IsZero())
	s.mu.RUnlock()
}

func TestInvalidPayload(t *testing.T) {
	s := newTestSession()

	msg := protocol.ClientMessage{
		Kind: protocol.MessageKindOp,
		Op:   json.RawMessage(`not valid json`),
	}
	resp, err := s.ProcessClientMessage(msg, "alice")
	require.ErrorIs(t, err, ErrInvalidPayload)
	require.Nil(t, resp)
}
