package features

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"time"
)

// NoopCollabService is a POC implementation of CollabService that wraps client
// messages into ServerMessage format for broadcast. It does not provide
// sequencing guarantees or lock management — just enough to relay operations
// between connected clients.
type NoopCollabService struct {
	seq atomic.Int64
}

// ProvideNoopCollabService is a Wire provider for a no-op CollabService.
func ProvideNoopCollabService() CollabService {
	return &NoopCollabService{}
}

func (s *NoopCollabService) UserJoin(_ context.Context, _, _, _, _, _ string) (*CollabSessionInfo, error) {
	return &CollabSessionInfo{
		Users: []CollabUserInfo{},
		Locks: make(map[string]string),
		Seq:   s.seq.Load(),
	}, nil
}

func (s *NoopCollabService) UserLeave(_ context.Context, _, _, _ string) error {
	return nil
}

// clientMessage is the shape of what the frontend sends on the ops channel.
type clientMessage struct {
	Kind string          `json:"kind"`
	Op   json.RawMessage `json:"op"`
}

// serverMessage is the shape the frontend expects to receive from the ops channel.
type serverMessage struct {
	Seq       int64           `json:"seq"`
	Kind      string          `json:"kind"`
	Op        json.RawMessage `json:"op"`
	UserID    string          `json:"userId"`
	Timestamp int64           `json:"timestamp"`
}

func (s *NoopCollabService) ProcessMessage(_ context.Context, _, _ string, data []byte, userID string) ([]byte, error) {
	var msg clientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		// If we can't parse it, pass through as-is (best effort).
		return data, nil
	}

	out := serverMessage{
		Seq:       s.seq.Add(1),
		Kind:      msg.Kind,
		Op:        msg.Op,
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
	}

	return json.Marshal(out)
}
