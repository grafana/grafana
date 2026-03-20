package collab

import (
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetOrCreate(t *testing.T) {
	m := NewSessionManager()

	s1 := m.GetOrCreate("default", "dash-1")
	require.NotNil(t, s1)
	require.Equal(t, "dash-1", s1.DashboardUID)
	require.Equal(t, "default", s1.Namespace)

	// Same key returns same session.
	s2 := m.GetOrCreate("default", "dash-1")
	require.Same(t, s1, s2)

	// Different key returns different session.
	s3 := m.GetOrCreate("default", "dash-2")
	require.NotSame(t, s1, s3)

	// Different namespace returns different session.
	s4 := m.GetOrCreate("other", "dash-1")
	require.NotSame(t, s1, s4)
}

func TestRemove(t *testing.T) {
	m := NewSessionManager()

	m.GetOrCreate("default", "dash-1")
	m.Remove("default", "dash-1")

	// After removal, GetOrCreate returns a new session.
	s := m.GetOrCreate("default", "dash-1")
	require.Empty(t, s.Users)
}

func TestUserJoin(t *testing.T) {
	m := NewSessionManager()

	s := m.UserJoin("default", "dash-1", "user-1", UserState{
		DisplayName: "Alice",
		AvatarURL:   "https://example.com/alice.png",
	})

	require.Len(t, s.Users, 1)
	u := s.Users["user-1"]
	require.Equal(t, "user-1", u.UserID)
	require.Equal(t, "Alice", u.DisplayName)
	require.NotEmpty(t, u.Color)
	require.False(t, u.JoinedAt.IsZero())
}

func TestUserJoinOverridesColorFromInfo(t *testing.T) {
	m := NewSessionManager()

	s := m.UserJoin("default", "dash-1", "user-1", UserState{
		DisplayName: "Alice",
		Color:       "#000000", // should be overridden
	})

	u := s.Users["user-1"]
	// Color is assigned deterministically, not from the info.
	require.Equal(t, assignColor("user-1"), u.Color)
}

func TestUserLeave(t *testing.T) {
	m := NewSessionManager()

	m.UserJoin("default", "dash-1", "user-1", UserState{DisplayName: "Alice"})
	m.UserJoin("default", "dash-1", "user-2", UserState{DisplayName: "Bob"})

	session, remaining := m.UserLeave("default", "dash-1", "user-1")
	require.Equal(t, 1, remaining)
	require.NotNil(t, session)

	// Session still exists with one user.
	s := m.GetOrCreate("default", "dash-1")
	require.Len(t, s.Users, 1)
	require.NotNil(t, s.Users["user-2"])
}

func TestUserLeaveLastUserReturnsSession(t *testing.T) {
	m := NewSessionManager()

	m.UserJoin("default", "dash-1", "user-1", UserState{DisplayName: "Alice"})
	session, remaining := m.UserLeave("default", "dash-1", "user-1")
	require.Equal(t, 0, remaining)
	// Session is returned so caller can perform final autosave.
	require.NotNil(t, session)
	require.Equal(t, "dash-1", session.DashboardUID)

	// Session is NOT auto-deleted — caller must call CleanupSession.
	s := m.store.Get("default/dash-1")
	require.NotNil(t, s)

	// After cleanup, session is removed.
	m.CleanupSession("default", "dash-1")
	s = m.store.Get("default/dash-1")
	require.Nil(t, s)
}

func TestUserLeaveNonExistentSession(t *testing.T) {
	m := NewSessionManager()

	session, remaining := m.UserLeave("default", "no-such-dash", "user-1")
	require.Equal(t, 0, remaining)
	require.Nil(t, session)
}

func TestColorAssignmentDeterministic(t *testing.T) {
	c1 := assignColor("user-123")
	c2 := assignColor("user-123")
	require.Equal(t, c1, c2)
}

func TestColorAssignmentDistribution(t *testing.T) {
	seen := make(map[string]bool)
	for i := range 100 {
		c := assignColor(fmt.Sprintf("user-%d", i))
		seen[c] = true
	}
	// With 100 users and 12 colors, we should see most colors used.
	require.GreaterOrEqual(t, len(seen), 8)
}

func TestConcurrentAccess(t *testing.T) {
	m := NewSessionManager()
	var wg sync.WaitGroup

	// 10 goroutines joining and leaving concurrently.
	for i := range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			userId := fmt.Sprintf("user-%d", i)
			m.UserJoin("default", "dash-1", userId, UserState{
				DisplayName: fmt.Sprintf("User %d", i),
			})
		}()
	}
	wg.Wait()

	s := m.GetOrCreate("default", "dash-1")
	s.mu.RLock()
	require.Len(t, s.Users, 10)
	s.mu.RUnlock()

	// All 10 leave concurrently.
	for i := range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			userId := fmt.Sprintf("user-%d", i)
			_, _ = m.UserLeave("default", "dash-1", userId)
		}()
	}
	wg.Wait()

	// Cleanup session after all users left.
	m.CleanupSession("default", "dash-1")

	// Session should be destroyed.
	s = m.GetOrCreate("default", "dash-1")
	require.Empty(t, s.Users)
}

func TestConcurrentJoinLeaveInterleaved(t *testing.T) {
	m := NewSessionManager()
	var wg sync.WaitGroup

	// Interleaved joins and leaves across multiple dashboards.
	for i := range 10 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			userId := fmt.Sprintf("user-%d", i)
			dashUID := fmt.Sprintf("dash-%d", i%3)
			m.UserJoin("default", dashUID, userId, UserState{
				DisplayName: fmt.Sprintf("User %d", i),
			})
		}()
		go func() {
			defer wg.Done()
			userId := fmt.Sprintf("user-%d", i)
			dashUID := fmt.Sprintf("dash-%d", i%3)
			_, _ = m.UserLeave("default", dashUID, userId)
		}()
	}
	wg.Wait()
	// No panic or race — test passes if we get here.
}

func TestNewSessionManagerWithStore(t *testing.T) {
	store := newMemoryStore()
	m := NewSessionManagerWithStore(store)

	m.UserJoin("default", "dash-1", "user-1", UserState{DisplayName: "Alice"})

	// Verify the store has the session.
	s := store.Get("default/dash-1")
	require.NotNil(t, s)
	require.Len(t, s.Users, 1)
}
