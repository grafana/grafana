package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"k8s.io/client-go/tools/cache"
)

var JobQueueOperator = runner.Operator{
	Name:        "provisioning-jobqueue",
	Description: "Pick and execute provisioning jobs using lease-based claiming",
	Logger:      "provisioning-jobqueue-controller",
	Defaults:    operatorDefaults,
	Build: func(rt *runner.Runtime) (*runner.Parts, error) {
		r, err := newJobQueueRunner(rt)
		if err != nil {
			return nil, err
		}
		manifestWatcher, err := r.ManifestWatcher()
		if err != nil {
			return nil, err
		}
		return &runner.Parts{
			Services: []services.Service{manifestWatcher},
			Run: func(ctx context.Context, ready func()) error {
				return runJobQueueController(ctx, rt.Logger, r, ready)
			},
			// Running jobs get their full timeout to finish before the process exits.
			ShutdownTimeout: r.maxJobTimeout + 30*time.Second,
		}, nil
	},
}

func runJobQueueController(ctx context.Context, logger logging.Logger, r *jobQueueRunner, ready func()) error {
	queue, err := buildJobQueue(r)
	if err != nil {
		return fmt.Errorf("build job queue: %w", err)
	}

	queueDone := make(chan struct{})
	go func() {
		defer close(queueDone)
		if err := queue.Run(ctx); err != nil {
			logger.Error("job driver failed", "error", err)
		}
		logger.Info("job driver stopped")
	}()

	if !cache.WaitForCacheSync(ctx.Done(), queue.HasSynced) {
		return fmt.Errorf("failed to sync job informer cache")
	}
	ready()
	<-queueDone
	return nil
}

type jobQueueRunner struct {
	*ProvisioningRunner
	maxJobTimeout        time.Duration
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	concurrentDrivers    int
	maxSyncWorkers       int
}

func newJobQueueRunner(rt *runner.Runtime) (*jobQueueRunner, error) {
	r, err := newProvisioningRunner(rt)
	if err != nil {
		return nil, err
	}

	operatorSec := rt.Cfg.SectionWithEnvOverrides("operator")

	// The jobs informer resyncs on jobInterval and that resync is the driver's
	// only recovery path for unclaimed jobs. A non-positive value would disable
	// the apiserver informer's resync entirely (and fall back to an unrelated
	// default under NATS), so clamp it to the default instead.
	jobInterval := operatorSec.Key("job_interval").MustDuration(30 * time.Second)
	if jobInterval <= 0 {
		jobInterval = 30 * time.Second
	}

	return &jobQueueRunner{
		ProvisioningRunner:   r,
		concurrentDrivers:    operatorSec.Key("concurrent_drivers").MustInt(3),
		maxSyncWorkers:       operatorSec.Key("max_sync_workers").MustInt(10),
		maxJobTimeout:        operatorSec.Key("max_job_timeout").MustDuration(20 * time.Minute),
		jobInterval:          jobInterval,
		leaseRenewalInterval: operatorSec.Key("lease_renewal_interval").MustDuration(jobs.ClaimExpiry / 3),
	}, nil
}
