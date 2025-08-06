package jobs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// ConcurrentJobDriver manages multiple jobDriver instances for concurrent job processing.
type ConcurrentJobDriver struct {
	numDrivers      int
	jobTimeout      time.Duration
	cleanupInterval time.Duration
	jobInterval     time.Duration
	store           Store
	repoGetter      RepoGetter
	historicJobs    History
	workers         []Worker
	notifications   chan struct{}
}

// NewConcurrentJobDriver creates a new concurrent job driver that spawns multiple job drivers.
func NewConcurrentJobDriver(
	numDrivers int,
	jobTimeout, cleanupInterval, jobInterval time.Duration,
	store Store,
	repoGetter RepoGetter,
	historicJobs History,
	notifications chan struct{},
	workers ...Worker,
) (*ConcurrentJobDriver, error) {
	if numDrivers <= 0 {
		return nil, fmt.Errorf("numWorkers must be greater than 0, got %d", numDrivers)
	}
	if cleanupInterval < jobTimeout {
		return nil, fmt.Errorf("the cleanup interval must be larger than the jobTimeout (cleanup:%s < job:%s)",
			cleanupInterval.String(), jobTimeout.String())
	}
	return &ConcurrentJobDriver{
		numDrivers:      numDrivers,
		jobTimeout:      jobTimeout,
		cleanupInterval: cleanupInterval,
		jobInterval:     jobInterval,
		store:           store,
		repoGetter:      repoGetter,
		historicJobs:    historicJobs,
		workers:         workers,
		notifications:   notifications,
	}, nil
}

// Run starts multiple job drivers concurrently and handles cleanup coordination.
// This is a blocking function that will run until the context is canceled or an error occurs.
func (c *ConcurrentJobDriver) Run(ctx context.Context) error {
	logger := logging.FromContext(ctx).With("logger", "concurrent-job-driver", "num_drivers", c.numDrivers)
	logger.Info("starting concurrent job driver")

	// Set up cleanup ticker - only one cleanup process for all workers
	cleanupTicker := time.NewTicker(c.cleanupInterval)
	defer cleanupTicker.Stop()

	// Initial cleanup
	if err := c.store.Cleanup(ctx); err != nil {
		logger.Error("failed to clean up old jobs at start", "error", err)
	}

	var wg sync.WaitGroup
	errChan := make(chan error, c.numDrivers+1) // +1 for cleanup goroutine

	// Start cleanup goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-cleanupTicker.C:
				if err := c.store.Cleanup(ctx); err != nil {
					logger.Error("failed to cleanup jobs", "error", err)
				}
			case <-ctx.Done():
				logger.Debug("cleanup goroutine stopping")
				return
			}
		}
	}()

	// Start driver goroutines
	for i := 0; i < c.numDrivers; i++ {
		wg.Add(1)
		go func(driverID int) {
			defer wg.Done()

			driverLogger := logger.With("driver_id", driverID)
			driverCtx := logging.Context(ctx, driverLogger)

			driver, err := NewJobDriver(
				c.jobTimeout,
				c.jobInterval,
				c.store,
				c.repoGetter,
				c.historicJobs,
				c.notifications,
				c.workers...,
			)
			if err != nil {
				driverLogger.Error("failed to create job driver", "error", err)
				errChan <- err
				return
			}

			driverLogger.Debug("starting job driver")
			if err := driver.Run(driverCtx); err != nil {
				driverLogger.Error("job driver failed", "error", err)
				errChan <- err
				return
			}
			driverLogger.Debug("job driver stopped")
		}(i)
	}

	// Wait for all drivers to finish
	go func() {
		wg.Wait()
		close(errChan)
	}()

	// Return the first error encountered, if any
	for err := range errChan {
		if err != nil {
			logger.Error("concurrent job driver error", "error", err)
			return err
		}
	}

	logger.Info("all job driver workers stopped")
	return ctx.Err()
}
