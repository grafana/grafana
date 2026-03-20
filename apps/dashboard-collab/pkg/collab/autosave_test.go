package collab

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/dashboard-collab/pkg/protocol"
)

// fakeClock provides deterministic time control for tests.
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func newFakeClock(t time.Time) *fakeClock {
	return &fakeClock{now: t}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

func (c *fakeClock) NewTicker(_ time.Duration) Ticker {
	return &fakeTicker{ch: make(chan time.Time, 1)}
}

// fakeTicker allows manual ticking in tests.
type fakeTicker struct {
	ch chan time.Time
}

func (f *fakeTicker) C() <-chan time.Time { return f.ch }
func (f *fakeTicker) Stop()              {}
func (f *fakeTicker) Tick()              { f.ch <- time.Time{} }

// mockSaver records Save calls and can be configured to return errors.
type mockSaver struct {
	mu    sync.Mutex
	calls []saveCall
	err   error
}

type saveCall struct {
	Namespace   string
	UID         string
	VersionType string
}

func (m *mockSaver) Save(_ context.Context, namespace, uid, versionType string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, saveCall{namespace, uid, versionType})
	return m.err
}

func (m *mockSaver) CallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.calls)
}

func (m *mockSaver) LastCall() saveCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.calls[len(m.calls)-1]
}

func (m *mockSaver) SetError(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.err = err
}

// helper: simulate an op on a session to advance Seq and set LastOpTime.
func simulateOp(s *Session, clock *fakeClock) {
	atomic.AddInt64(&s.Seq, 1)
	s.mu.Lock()
	s.LastOpTime = clock.Now()
	s.mu.Unlock()
}

func setupAutosave(t *testing.T) (*AutosaveWorker, *SessionManager, *fakeClock, *fakeTicker, *mockSaver) {
	t.Helper()
	sm := NewSessionManager()
	clk := newFakeClock(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	saver := &mockSaver{}

	worker := NewAutosaveWorker(AutosaveConfig{
		Sessions:   sm,
		Saver:      saver,
		Clock:      clk,
		Quiescence: 3 * time.Second,
		Interval:   1 * time.Second,
	})

	// Extract the fake ticker from the worker by creating one via the clock
	ft := &fakeTicker{ch: make(chan time.Time, 1)}

	return worker, sm, clk, ft, saver
}

func TestAutosaveTriggerAfterQuiescence(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	// Create a session with an op
	s := sm.GetOrCreate("default", "dash-1")
	simulateOp(s, clk)

	// Advance past quiescence
	clk.Advance(4 * time.Second)

	// Manually trigger a tick
	worker.tick(context.Background())

	require.Equal(t, 1, saver.CallCount())
	call := saver.LastCall()
	require.Equal(t, "default", call.Namespace)
	require.Equal(t, "dash-1", call.UID)
	require.Equal(t, "auto", call.VersionType)
}

func TestAutosaveNoSaveWithoutOps(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	// Create session but no ops (LastOpTime is zero)
	sm.GetOrCreate("default", "dash-1")

	clk.Advance(10 * time.Second)
	worker.tick(context.Background())

	require.Equal(t, 0, saver.CallCount())
}

func TestAutosaveNoSaveDuringActiveEditing(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	s := sm.GetOrCreate("default", "dash-1")
	simulateOp(s, clk)

	// Only 2 seconds have passed — within quiescence window
	clk.Advance(2 * time.Second)
	worker.tick(context.Background())

	require.Equal(t, 0, saver.CallCount())
}

func TestAutosaveNoSaveIfAlreadySaved(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	s := sm.GetOrCreate("default", "dash-1")
	simulateOp(s, clk)

	// First save
	clk.Advance(4 * time.Second)
	worker.tick(context.Background())
	require.Equal(t, 1, saver.CallCount())

	// Another tick with no new ops — should not save again
	clk.Advance(4 * time.Second)
	worker.tick(context.Background())
	require.Equal(t, 1, saver.CallCount())
}

func TestAutosaveSavesAgainAfterNewOps(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	s := sm.GetOrCreate("default", "dash-1")
	simulateOp(s, clk)

	// First save
	clk.Advance(4 * time.Second)
	worker.tick(context.Background())
	require.Equal(t, 1, saver.CallCount())

	// New op arrives
	clk.Advance(1 * time.Second)
	simulateOp(s, clk)

	// Wait for quiescence after new op
	clk.Advance(4 * time.Second)
	worker.tick(context.Background())
	require.Equal(t, 2, saver.CallCount())
}

func TestAutosaveRetryOnFailure(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	s := sm.GetOrCreate("default", "dash-1")
	simulateOp(s, clk)
	clk.Advance(4 * time.Second)

	// First attempt fails
	saver.SetError(context.DeadlineExceeded)
	worker.tick(context.Background())
	require.Equal(t, 1, saver.CallCount())

	// Second attempt succeeds
	saver.SetError(nil)
	clk.Advance(1 * time.Second)
	worker.tick(context.Background())
	require.Equal(t, 2, saver.CallCount())
	require.Equal(t, "auto", saver.LastCall().VersionType)
}

func TestAutosaveMultipleSessions(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	s1 := sm.GetOrCreate("default", "dash-1")
	s2 := sm.GetOrCreate("default", "dash-2")
	simulateOp(s1, clk)
	simulateOp(s2, clk)

	clk.Advance(4 * time.Second)
	worker.tick(context.Background())

	require.Equal(t, 2, saver.CallCount())
}

func TestAutosaveStopsOnContextCancel(t *testing.T) {
	sm := NewSessionManager()
	clk := newFakeClock(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	saver := &mockSaver{}

	worker := NewAutosaveWorker(AutosaveConfig{
		Sessions:   sm,
		Saver:      saver,
		Clock:      clk,
		Quiescence: 3 * time.Second,
		Interval:   1 * time.Second,
	})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(done)
	}()

	cancel()

	select {
	case <-done:
		// Run exited cleanly
	case <-time.After(2 * time.Second):
		t.Fatal("autosave worker did not stop after context cancellation")
	}
}

func TestAutosaveWithSequencerIntegration(t *testing.T) {
	worker, sm, clk, _, saver := setupAutosave(t)

	// Use the actual sequencer to produce ops
	s := sm.UserJoin("default", "dash-1", "alice", UserState{DisplayName: "Alice"})
	s.LockTable.Acquire("panel-1", "alice")

	opPayload, _ := json.Marshal(protocol.CollabOperation{
		Mutation:   protocol.MutationRequest{Type: "UPDATE_PANEL", Payload: json.RawMessage(`{}`)},
		LockTarget: "panel-1",
	})
	msg := protocol.ClientMessage{
		Kind: protocol.MessageKindOp,
		Op:   opPayload,
	}

	_, err := s.ProcessClientMessage(msg, "alice")
	require.NoError(t, err)

	// Override LastOpTime with fake clock time for deterministic test
	s.mu.Lock()
	s.LastOpTime = clk.Now()
	s.mu.Unlock()

	clk.Advance(4 * time.Second)
	worker.tick(context.Background())

	require.Equal(t, 1, saver.CallCount())
	call := saver.LastCall()
	require.Equal(t, "default", call.Namespace)
	require.Equal(t, "dash-1", call.UID)
}
