package collab

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// DashboardSaver abstracts the dashboard persistence layer.
// The real implementation (wrapping the k8s client) is wired in Milestone 3.
type DashboardSaver interface {
	Save(ctx context.Context, namespace, uid string, versionType string) error
}

// Clock abstracts time for deterministic testing.
type Clock interface {
	Now() time.Time
	NewTicker(d time.Duration) Ticker
}

// Ticker abstracts time.Ticker for testing.
type Ticker interface {
	C() <-chan time.Time
	Stop()
}

// realClock uses the standard library time functions.
type realClock struct{}

func (realClock) Now() time.Time                   { return time.Now() }
func (realClock) NewTicker(d time.Duration) Ticker { return &realTicker{t: time.NewTicker(d)} }

type realTicker struct{ t *time.Ticker }

func (r *realTicker) C() <-chan time.Time { return r.t.C }
func (r *realTicker) Stop()              { r.t.Stop() }

// AutosaveWorker periodically saves dashboards that have unsaved operations
// after a quiescence period (no new ops for a given duration).
type AutosaveWorker struct {
	sessions   *SessionManager
	saver      DashboardSaver
	clock      Clock
	quiescence time.Duration
	interval   time.Duration
	// lastSavedSeq tracks the last saved sequence number per session key.
	lastSavedSeq map[string]int64
	mu           sync.Mutex
	logger       *slog.Logger
}

// AutosaveConfig configures the autosave worker.
type AutosaveConfig struct {
	Sessions   *SessionManager
	Saver      DashboardSaver
	Clock      Clock
	Quiescence time.Duration // default 3s
	Interval   time.Duration // default 1s
	Logger     *slog.Logger
}

// NewAutosaveWorker creates an autosave worker with the given configuration.
func NewAutosaveWorker(cfg AutosaveConfig) *AutosaveWorker {
	if cfg.Clock == nil {
		cfg.Clock = realClock{}
	}
	if cfg.Quiescence == 0 {
		cfg.Quiescence = 3 * time.Second
	}
	if cfg.Interval == 0 {
		cfg.Interval = 1 * time.Second
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	return &AutosaveWorker{
		sessions:     cfg.Sessions,
		saver:        cfg.Saver,
		clock:        cfg.Clock,
		quiescence:   cfg.Quiescence,
		interval:     cfg.Interval,
		lastSavedSeq: make(map[string]int64),
		logger:       cfg.Logger,
	}
}

// Run starts the autosave loop. It blocks until ctx is cancelled.
func (w *AutosaveWorker) Run(ctx context.Context) {
	ticker := w.clock.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C():
			w.tick(ctx)
		}
	}
}

// tick checks all active sessions and triggers saves where appropriate.
func (w *AutosaveWorker) tick(ctx context.Context) {
	now := w.clock.Now()

	w.sessions.ForEachSession(func(s *Session) {
		seq := s.GetSeq()
		lastOp := s.GetLastOpTime()

		// No operations yet — nothing to save.
		if lastOp.IsZero() {
			return
		}

		key := sessionKey(s.Namespace, s.DashboardUID)

		w.mu.Lock()
		savedSeq := w.lastSavedSeq[key]
		w.mu.Unlock()

		// No new ops since last save.
		if seq <= savedSeq {
			return
		}

		// Ops still flowing — wait for quiescence.
		if now.Sub(lastOp) < w.quiescence {
			return
		}

		// Quiescence reached with unsaved ops — trigger save.
		err := w.saver.Save(ctx, s.Namespace, s.DashboardUID, "auto")
		if err != nil {
			// On failure (e.g., version conflict): skip this cycle, retry next tick.
			w.logger.Warn("autosave failed, will retry",
				"namespace", s.Namespace,
				"uid", s.DashboardUID,
				"error", err,
			)
			return
		}

		w.mu.Lock()
		w.lastSavedSeq[key] = seq
		w.mu.Unlock()
	})
}
