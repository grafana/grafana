package scheduler

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	// DefaultMaxBackoff is the default maximum backoff duration for workers.
	DefaultMaxBackoff = 1 * time.Second
	// DefaultMinBackoff is the default minimum backoff duration for workers.
	DefaultMinBackoff = 100 * time.Millisecond
	// DefaultNumWorkers is the default number of workers in the scheduler.
	DefaultNumWorkers = 4
	// DefaultMaxRetries is the default maximum number of retries for dequeue operations.
	DefaultMaxRetries = 5
)

type WorkQueue interface {
	services.Service

	Dequeue(ctx context.Context) (runnable func(), err error)
}

// Worker processes items from the QoS request queue
type Worker struct {
	id         int
	queue      WorkQueue
	wg         *sync.WaitGroup
	maxBackoff time.Duration
	maxRetries int
	logger     log.Logger
}

func (w *Worker) run(ctx context.Context) {
	defer w.wg.Done()
	w.logger.Debug("worker started", "id", w.id)

	for ctx.Err() == nil {
		err := w.dequeueWithRetries(ctx)
		if err != nil {
			break
		}
	}
	w.logger.Debug("worker stopped", "id", w.id)
}

func (w *Worker) dequeueWithRetries(ctx context.Context) error {
	boff := backoff.New(ctx, backoff.Config{
		MinBackoff: DefaultMinBackoff,
		MaxBackoff: w.maxBackoff,
		MaxRetries: w.maxRetries,
	})

	for boff.Ongoing() {
		runnable, err := w.queue.Dequeue(ctx)
		if err == nil {
			runnable()
			break
		}

		if errors.Is(err, ErrQueueClosed) {
			w.logger.Error("queue closed, stopping worker", "id", w.id)
			return fmt.Errorf("worker %d: queue closed", w.id)
		}

		w.logger.Error("retrying dequeue", "id", w.id, "error", err, "attempt", boff.NumRetries())
		boff.Wait()
	}
	if err := boff.ErrCause(); err != nil {
		w.logger.Error("failed to dequeue after retries", "id", w.id, "error", err)
	}
	return nil
}

// Scheduler manages a pool of Workers consuming from a Queue.
type Scheduler struct {
	services.Service

	logger     log.Logger
	queue      WorkQueue
	wg         sync.WaitGroup
	maxBackoff time.Duration

	workers    []*Worker
	numWorkers int
}

// Config holds configuration for the Scheduler.
type Config struct {
	NumWorkers int
	MaxBackoff time.Duration
	MaxRetries int
	Logger     log.Logger
}

func (c *Config) validate() error {
	if c.NumWorkers <= 0 {
		c.NumWorkers = DefaultNumWorkers
	}
	if c.MaxBackoff <= 0 {
		c.MaxBackoff = DefaultMaxBackoff
	}
	if c.MaxRetries <= 0 {
		c.MaxRetries = DefaultMaxRetries
	}
	if c.Logger == nil {
		c.Logger = log.New("scheduler")
	}
	return nil
}

// NewScheduler creates a new scheduler instance.
func NewScheduler(queue WorkQueue, config *Config) (*Scheduler, error) {
	if queue == nil {
		return nil, errors.New("queue cannot be nil")
	}
	if err := config.validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	s := &Scheduler{
		logger:     config.Logger,
		queue:      queue,
		numWorkers: config.NumWorkers,
		maxBackoff: config.MaxBackoff,
		workers:    make([]*Worker, 0, config.NumWorkers),
	}

	s.Service = services.NewIdleService(s.starting, s.stopping)
	return s, nil
}

// starting is called by the services.Service lifecycle to start the scheduler.
func (s *Scheduler) starting(ctx context.Context) error {
	s.logger.Info("scheduler starting", "numWorkers", s.numWorkers)

	queueCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := s.queue.AwaitRunning(queueCtx); err != nil {
		return fmt.Errorf("queue is not running: %w", err)
	}

	s.workers = make([]*Worker, 0, s.numWorkers)
	s.wg.Add(s.numWorkers)

	for i := 0; i < s.numWorkers; i++ {
		worker := &Worker{
			id:         i,
			queue:      s.queue,
			wg:         &s.wg,
			maxBackoff: s.maxBackoff,
			logger:     s.logger,
		}
		s.workers = append(s.workers, worker)
		go worker.run(ctx)
	}

	s.logger.Info("scheduler started")
	return nil
}

// stopping is called by the services.Service lifecycle to stop the scheduler.
func (s *Scheduler) stopping(_ error) error {
	s.logger.Info("scheduler stopping")

	s.wg.Wait()

	s.logger.Info("scheduler stopped")
	return nil
}
