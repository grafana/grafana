package qos

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Worker processes items from the qos.
type Worker struct {
	id             int
	queue          *Queue
	wg             *sync.WaitGroup
	stopCh         <-chan struct{}
	dequeueTimeout time.Duration
	logger         log.Logger
}

func (w *Worker) run() {
	defer w.wg.Done()
	w.logger.Debug("Worker started", "id", w.id)

	for {
		select {
		case <-w.stopCh:
			w.logger.Debug("Worker received stop signal", "id", w.id)
			return
		default:
		}

		dequeueCtx, cancelDequeue := context.WithTimeout(context.Background(), w.dequeueTimeout)

		runnable, ok, err := w.queue.Dequeue(dequeueCtx)
		cancelDequeue()

		if err != nil {
			if errors.Is(err, ErrQueueClosed) {
				w.logger.Debug("Worker exiting due to queue closed", "id", w.id)
				return
			}
			if errors.Is(err, context.DeadlineExceeded) {
				continue
			}
			if errors.Is(err, context.Canceled) {
				w.logger.Debug("Worker exiting due to context canceled", "id", w.id)
				return
			}
			w.logger.Error("Error dequeuing item", "id", w.id, "error", err)
			select {
			case <-time.After(500 * time.Millisecond):
			case <-w.stopCh:
				w.logger.Debug("Worker received stop signal while in backoff", "id", w.id)
				return
			}
			continue
		}

		if !ok {
			continue
		}

		runnable()
	}
}

// Scheduler manages a pool of Workers consuming from a FairQueue.
type Scheduler struct {
	queue *Queue

	numWorkers int
	workers    []*Worker

	wg          sync.WaitGroup
	stopCh      chan struct{}
	startStopMu sync.Mutex

	dequeueTimeout time.Duration

	running bool
	logger  log.Logger
}

// SchedulerConfig holds configuration for the Scheduler.
type SchedulerConfig struct {
	NumWorkers     int
	DequeueTimeout time.Duration
	Logger         log.Logger
}

func (c *SchedulerConfig) validate() error {
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
func NewScheduler(queue *Queue, config *SchedulerConfig) (*Scheduler, error) {
	if queue == nil {
		return nil, errors.New("scheduler: qos cannot be nil")
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

	s.stopCh = make(chan struct{})
	s.running = true
	s.workers = make([]*Worker, 0, s.numWorkers)

	s.logger.Info("Scheduler starting", "numWorkers", s.numWorkers)
	s.wg.Add(s.numWorkers)

	for i := 0; i < s.numWorkers; i++ {
		worker := &Worker{
			id:             i,
			queue:          s.queue,
			wg:             &s.wg,
			stopCh:         s.stopCh,
			dequeueTimeout: s.dequeueTimeout,
			logger:         s.logger,
		}
		s.workers = append(s.workers, worker)
		go worker.run()
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

	close(s.stopCh)
	s.running = false

	s.startStopMu.Unlock()

	// Close the queue after signaling workers to allow them to finish current work
	// while unblocking those waiting in Dequeue.
	s.queue.Close()

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
