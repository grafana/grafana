package scheduler

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/infra/log"
)

// Worker processes items from the qos.
type Worker struct {
	id             int
	queue          *Queue
	wg             *sync.WaitGroup
	dequeueTimeout time.Duration
	logger         log.Logger
}

func (w *Worker) run(ctx context.Context) {
	defer w.wg.Done()
	w.logger.Debug("Worker started", "id", w.id)

	for {
		select {
		case <-ctx.Done():
			w.logger.Debug("Worker context canceled", "id", w.id)
			return
		default:
		}

		w.dequeueWithRetries(ctx)
	}
}

func (w *Worker) dequeueWithRetries(ctx context.Context) {
	boff := backoff.New(ctx, backoff.Config{
		MinBackoff: 100 * time.Millisecond,
		MaxBackoff: w.dequeueTimeout,
		MaxRetries: 5,
	})

	for boff.Ongoing() {
		runnable, ok, err := w.queue.Dequeue(ctx)
		if err != nil {
			if errors.Is(err, ErrQueueClosed) {
				w.logger.Debug("Worker exiting due to queue closed", "id", w.id)
				return
			}
			if errors.Is(err, context.DeadlineExceeded) {
				boff.Wait()
				if ctx.Err() != nil {
					w.logger.Debug("Worker backoff exhausted", "id", w.id)
					return
				}
				continue
			}
			w.logger.Error("Error dequeuing item", "id", w.id, "error", err)
			boff.Wait()
			if ctx.Err() != nil {
				w.logger.Debug("Worker backoff exhausted", "id", w.id)
				return
			}
			continue
		}

		if !ok {
			continue
		}

		boff.Reset()

		runnable()
	}
}

// Scheduler manages a pool of Workers consuming from a FairQueue.
type Scheduler struct {
	queue          *Queue
	wg             sync.WaitGroup
	stopScheduler  context.CancelFunc
	dequeueTimeout time.Duration
	logger         log.Logger

	startStopMu sync.Mutex
	workers     []*Worker
	running     bool
	numWorkers  int
}

// Config holds configuration for the Scheduler.
type Config struct {
	NumWorkers     int
	DequeueTimeout time.Duration
	Logger         log.Logger
}

func (c *Config) validate() error {
	if c.NumWorkers <= 0 {
		return fmt.Errorf("NumWorkers must be positive, got %d", c.NumWorkers)
	}
	if c.DequeueTimeout <= 0 {
		c.DequeueTimeout = 5 * time.Second
	}
	if c.Logger == nil {
		c.Logger = log.New("qos.scheduler")
	}
	return nil
}

// NewScheduler creates a new scheduler instance.
func NewScheduler(queue *Queue, config *Config) (*Scheduler, error) {
	if queue == nil {
		return nil, errors.New("scheduler: queue cannot be nil")
	}
	if err := config.validate(); err != nil {
		return nil, fmt.Errorf("scheduler: invalid config: %w", err)
	}

	s := &Scheduler{
		queue:          queue,
		numWorkers:     config.NumWorkers,
		dequeueTimeout: config.DequeueTimeout,
		workers:        make([]*Worker, 0, config.NumWorkers),
		logger:         config.Logger,
	}
	return s, nil
}

// Start initializes and starts the worker goroutines.
func (s *Scheduler) Start() error {
	s.startStopMu.Lock()
	defer s.startStopMu.Unlock()

	if s.running {
		return errors.New("scheduler: already started")
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.stopScheduler = cancel
	s.running = true
	s.workers = make([]*Worker, 0, s.numWorkers)

	s.logger.Info("Scheduler starting", "numWorkers", s.numWorkers)
	s.wg.Add(s.numWorkers)

	for i := 0; i < s.numWorkers; i++ {
		worker := &Worker{
			id:             i,
			queue:          s.queue,
			wg:             &s.wg,
			dequeueTimeout: s.dequeueTimeout,
			logger:         s.logger,
		}
		s.workers = append(s.workers, worker)
		go worker.run(ctx)
	}

	s.logger.Info("Scheduler started")
	return nil
}

// Stop signals all workers to stop, closes the qos, and waits for them to finish.
func (s *Scheduler) Stop() {
	s.startStopMu.Lock()
	if !s.running {
		s.startStopMu.Unlock()
		s.logger.Info("Scheduler not running, nothing to stop")
		return
	}

	s.logger.Info("Scheduler stopping")

	s.stopScheduler()
	s.running = false

	s.startStopMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	// Close the queue after signaling workers to allow them to finish current work
	// while unblocking those waiting in Dequeue.
	s.queue.Close(ctx)

	s.wg.Wait()

	s.startStopMu.Lock()
	s.workers = nil
	s.startStopMu.Unlock()

	s.logger.Info("Scheduler stopped")
}

// IsRunning returns true if the scheduler is currently running.
func (s *Scheduler) IsRunning() bool {
	s.startStopMu.Lock()
	defer s.startStopMu.Unlock()
	return s.running
}
