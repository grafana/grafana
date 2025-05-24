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

// Worker processes items from the QoS request queue
type Worker struct {
	id         int
	queue      *Queue
	wg         *sync.WaitGroup
	maxBackoff time.Duration
	logger     log.Logger
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
		MaxBackoff: w.maxBackoff,
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

		boff.Reset()

		if !ok {
			continue
		}

		runnable()
	}
}

// Scheduler manages a pool of Workers consuming from a FairQueue.
type Scheduler struct {
	services.Service

	logger     log.Logger
	queue      *Queue
	wg         sync.WaitGroup
	maxBackoff time.Duration

	// Subservices manager
	subservices        *services.Manager
	subservicesWatcher *services.FailureWatcher

	workers    []*Worker
	numWorkers int
}

// Config holds configuration for the Scheduler.
type Config struct {
	NumWorkers int
	MaxBackoff time.Duration
	Logger     log.Logger
}

func (c *Config) validate() error {
	if c.NumWorkers <= 0 {
		return fmt.Errorf("NumWorkers must be positive, got %d", c.NumWorkers)
	}
	if c.MaxBackoff <= 0 {
		c.MaxBackoff = 5 * time.Second
	}
	if c.Logger == nil {
		c.Logger = log.New("qos.scheduler")
	}
	return nil
}

// NewScheduler creates a new scheduler instance.
func NewScheduler(queue *Queue, config *Config) (*Scheduler, error) {
	var err error

	if queue == nil {
		return nil, errors.New("scheduler: queue cannot be nil")
	}
	if err := config.validate(); err != nil {
		return nil, fmt.Errorf("scheduler: invalid config: %w", err)
	}

	s := &Scheduler{
		logger:             config.Logger,
		queue:              queue,
		numWorkers:         config.NumWorkers,
		maxBackoff:         config.MaxBackoff,
		workers:            make([]*Worker, 0, config.NumWorkers),
		subservicesWatcher: services.NewFailureWatcher(),
	}

	subservices := []services.Service{s.queue}
	s.subservices, err = services.NewManager(subservices...)
	if err != nil {
		return nil, fmt.Errorf("scheduler: failed to create subservices manager: %w", err)
	}
	s.Service = services.NewBasicService(s.starting, s.running, s.stopping)
	return s, nil
}

// starting is called by the services.Service lifecycle to start the scheduler.
func (s *Scheduler) starting(ctx context.Context) error {
	s.subservicesWatcher.WatchManager(s.subservices)

	if err := services.StartManagerAndAwaitHealthy(ctx, s.subservices); err != nil {
		return fmt.Errorf("scheduler: failed to start subservices: %w", err)
	}

	s.logger.Info("Scheduler starting", "numWorkers", s.numWorkers)
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

	s.logger.Info("Scheduler started")
	return nil
}

// running is called by the services.Service lifecycle to check if the scheduler is running.
func (s *Scheduler) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-s.subservicesWatcher.Chan():
		return fmt.Errorf("scheduler: subservice failure: %w", err)
	}
}

// stopping is called by the services.Service lifecycle to stop the scheduler.
func (s *Scheduler) stopping(_ error) error {
	s.logger.Info("Scheduler stopping")

	err := services.StopManagerAndAwaitStopped(context.Background(), s.subservices)
	if err != nil {
		return fmt.Errorf("scheduler: failed to stop subservices: %w", err)
	}

	s.logger.Info("Scheduler stopped")
	return nil
}
