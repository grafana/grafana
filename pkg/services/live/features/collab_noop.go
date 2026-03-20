package features

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// NoopCollabService is a POC implementation of CollabService that wraps client
// messages into ServerMessage format for broadcast. It provides basic user
// tracking and presence but no sequencing guarantees or lock management.
type NoopCollabService struct {
	seq   atomic.Int64
	mu    sync.RWMutex
	users map[string]map[string]CollabUserInfo // sessionKey → userID → info
}

// ProvideNoopCollabService is a Wire provider for a no-op CollabService.
func ProvideNoopCollabService() CollabService {
	return &NoopCollabService{
		users: make(map[string]map[string]CollabUserInfo),
	}
}

// 12 distinct colors for user identification
var userColors = []string{
	"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
	"#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
	"#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
}

func colorForUser(userID string) string {
	h := md5.Sum([]byte(userID))
	return userColors[int(h[0])%len(userColors)]
}

func sessionKey(namespace, uid string) string {
	return fmt.Sprintf("%s/%s", namespace, uid)
}

func (s *NoopCollabService) UserJoin(_ context.Context, namespace, dashboardUID, userID, displayName, avatarURL string) (*CollabSessionInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := sessionKey(namespace, dashboardUID)
	if s.users[key] == nil {
		s.users[key] = make(map[string]CollabUserInfo)
	}

	s.users[key][userID] = CollabUserInfo{
		UserID:      userID,
		DisplayName: displayName,
		AvatarURL:   avatarURL,
		Color:       colorForUser(userID),
	}

	users := make([]CollabUserInfo, 0, len(s.users[key]))
	for _, u := range s.users[key] {
		users = append(users, u)
	}

	return &CollabSessionInfo{
		Users: users,
		Locks: make(map[string]string),
		Seq:   s.seq.Load(),
	}, nil
}

func (s *NoopCollabService) UserLeave(_ context.Context, namespace, dashboardUID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := sessionKey(namespace, dashboardUID)
	if s.users[key] != nil {
		delete(s.users[key], userID)
		if len(s.users[key]) == 0 {
			delete(s.users, key)
		}
	}
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
