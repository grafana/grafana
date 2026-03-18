package collab

import (
	"hash/fnv"
	"sync"
	"time"
)

// colorPalette is a set of 12 visually distinct colors for user identification.
var colorPalette = [12]string{
	"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
	"#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
	"#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
}

// SessionStore abstracts session persistence. The default implementation is
// in-memory, but this interface allows swapping in a distributed store later.
type SessionStore interface {
	// Get returns the session for the given key, or nil if not found.
	Get(key string) *Session
	// Set stores a session under the given key.
	Set(key string, session *Session)
	// Delete removes a session by key.
	Delete(key string)
}

// memoryStore is the default in-memory SessionStore.
type memoryStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

func newMemoryStore() *memoryStore {
	return &memoryStore{
		sessions: make(map[string]*Session),
	}
}

func (m *memoryStore) Get(key string) *Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[key]
}

func (m *memoryStore) Set(key string, session *Session) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[key] = session
}

func (m *memoryStore) Delete(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, key)
}

// Session represents an active collaboration session for a single dashboard.
type Session struct {
	DashboardUID string
	Namespace    string
	Users        map[string]*UserState // userId → state
	LockTable    *LockTable            // panel-level soft locks
	Seq          int64                 // monotonic counter
	LastOpTime   time.Time             // for autosave quiescence
	mu           sync.RWMutex
}

// UserState represents a user's presence in a collaboration session.
type UserState struct {
	UserID      string
	DisplayName string
	AvatarURL   string
	Color       string
	JoinedAt    time.Time
}

// SessionManager manages collaboration sessions across dashboards.
type SessionManager struct {
	store SessionStore
	mu    sync.RWMutex
}

// NewSessionManager creates a SessionManager with the default in-memory store.
func NewSessionManager() *SessionManager {
	return &SessionManager{
		store: newMemoryStore(),
	}
}

// NewSessionManagerWithStore creates a SessionManager backed by the given store.
func NewSessionManagerWithStore(store SessionStore) *SessionManager {
	return &SessionManager{
		store: store,
	}
}

// sessionKey builds the map key for a given namespace and dashboard UID.
func sessionKey(namespace, uid string) string {
	return namespace + "/" + uid
}

// GetOrCreate returns the existing session or creates a new empty one.
func (m *SessionManager) GetOrCreate(namespace, uid string) *Session {
	key := sessionKey(namespace, uid)

	m.mu.RLock()
	s := m.store.Get(key)
	m.mu.RUnlock()
	if s != nil {
		return s
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock.
	s = m.store.Get(key)
	if s != nil {
		return s
	}

	s = &Session{
		DashboardUID: uid,
		Namespace:    namespace,
		Users:        make(map[string]*UserState),
		LockTable:    NewLockTable(),
	}
	m.store.Set(key, s)
	return s
}

// Remove deletes a session from the manager.
func (m *SessionManager) Remove(namespace, uid string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.store.Delete(sessionKey(namespace, uid))
}

// UserJoin adds a user to a session, creating the session if needed.
// The Color field in info is ignored — color is assigned deterministically
// based on userId.
func (m *SessionManager) UserJoin(namespace, uid, userId string, info UserState) *Session {
	s := m.GetOrCreate(namespace, uid)

	s.mu.Lock()
	defer s.mu.Unlock()

	info.Color = assignColor(userId)
	info.JoinedAt = time.Now()
	info.UserID = userId
	s.Users[userId] = &info
	return s
}

// UserLeave removes a user from a session and returns the number of remaining
// users. If no users remain, the session is automatically removed.
func (m *SessionManager) UserLeave(namespace, uid, userId string) (remaining int) {
	key := sessionKey(namespace, uid)

	m.mu.RLock()
	s := m.store.Get(key)
	m.mu.RUnlock()
	if s == nil {
		return 0
	}

	s.mu.Lock()
	delete(s.Users, userId)
	remaining = len(s.Users)
	s.mu.Unlock()

	if remaining == 0 {
		m.mu.Lock()
		// Re-check under write lock — another goroutine may have joined.
		s.mu.RLock()
		if len(s.Users) == 0 {
			m.store.Delete(key)
		}
		s.mu.RUnlock()
		m.mu.Unlock()
	}

	return remaining
}

// assignColor deterministically maps a userId to one of 12 palette colors.
func assignColor(userId string) string {
	h := fnv.New32a()
	_, _ = h.Write([]byte(userId))
	return colorPalette[h.Sum32()%uint32(len(colorPalette))]
}
