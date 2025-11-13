package jobs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
)

// ConcurrentJobDriver manages multiple jobDriver instances for concurrent job processing.
type ConcurrentJobDriver struct {
	numDrivers           int
	jobTimeout           time.Duration
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	store                Store
	repoGetter           RepoGetter
	historicJobs         HistoryWriter
	workers              []Worker
	notifications        chan struct{}
}

// NewConcurrentJobDriver creates a new concurrent job driver that spawns multiple job drivers.
func NewConcurrentJobDriver(
	numDrivers int,
	jobTimeout, jobInterval, leaseRenewalInterval time.Duration,
	store Store,
	repoGetter RepoGetter,
	historicJobs HistoryWriter,
	notifications chan struct{},
	registry prometheus.Registerer,
	workers ...Worker,
) (*ConcurrentJobDriver, error) {
	if numDrivers <= 0 {
		return nil, fmt.Errorf("numWorkers must be greater than 0, got %d", numDrivers)
	}
	// Default lease renewal interval to 1/3 of job timeout, minimum 5 seconds
	if leaseRenewalInterval <= 0 {
		leaseRenewalInterval = jobTimeout / 3
	}
	if leaseRenewalInterval < 5*time.Second {
		leaseRenewalInterval = 5 * time.Second
	}

	recordConcurrentDriverMetric(registry, numDrivers)

	return &ConcurrentJobDriver{
		numDrivers:           numDrivers,
		jobTimeout:           jobTimeout,
		jobInterval:          jobInterval,
		leaseRenewalInterval: leaseRenewalInterval,
		store:                store,
		repoGetter:           repoGetter,
		historicJobs:         historicJobs,
		workers:              workers,
		notifications:        notifications,
	}, nil
}

// Run starts multiple job drivers concurrently.
// This is a blocking function that will run until the context is canceled or an error occurs.
//
// Note: This function intentionally does NOT create a tracing span because it runs indefinitely
// until shutdown. Individual job processing operations already have their own spans.
func (c *ConcurrentJobDriver) Run(ctx context.Context) error {
	logger := logging.FromContext(ctx).With("logger", "concurrent-job-driver", "num_drivers", c.numDrivers)
	logger.Info("start concurrent job driver", "num_drivers", c.numDrivers)

	var wg sync.WaitGroup
	errChan := make(chan error, c.numDrivers)

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
				c.leaseRenewalInterval,
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

			driverLogger.Info("start job driver")
			if err := driver.Run(driverCtx); err != nil {
				driverLogger.Error("job driver failed", "error", err)
				errChan <- err
				return
			}
			driverLogger.Info("job driver stopped")
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

	if ctx.Err() != nil {
		logger.Info("all job drivers gracefully stopped")
		return nil
	}

	return fmt.Errorf("concurrent job driver stopped unexpectedly")
}
