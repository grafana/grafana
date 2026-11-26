package provisioning

import (
	"context"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

var JobsOperator = runner.Operator{
	Name:        "provisioning-jobs",
	Description: "Manage provisioning job and history cleanup",
	Logger:      "provisioning-job-controller",
	Defaults:    operatorDefaults,
	NoNATS:      true,
	Build: func(rt *runner.Runtime) (*runner.Parts, error) {
		r, err := newJobsRunner(rt)
		if err != nil {
			return nil, err
		}
		return &runner.Parts{
			Run: func(ctx context.Context, ready func()) error {
				return runJobController(ctx, rt.Logger, r, ready)
			},
			ShutdownTimeout: 30 * time.Second,
		}, nil
	},
}

func runJobController(ctx context.Context, logger logging.Logger, r *jobsRunner, ready func()) error {
	common, err := r.ControllerCommon()
	if err != nil {
		return err
	}

	// Historic-job cleanup is age-based and needs no live events: when NATS is off
	// the source is an apiserver informer (watch-fed cache replayed on resync),
	// when NATS is on it is a cron-style periodic re-list. Either way each pass
	// delivers every job to the handler, which deletes the expired ones. It only
	// runs when a history expiration is configured; the expired-job reaper below
	// runs regardless. The source choice reads the NATS config flag directly, not a
	// subscriber: this operator has no NATS consumer role and holds no subscriber.
	var historySource informer.DeltaSource
	if r.historyExpiration > 0 {
		historySource, err = controller.ProvideHistoryJobCleanup(ctx, r.Cfg.NATS.Enabled, common.Client, r.historyExpiration)
		if err != nil {
			return err
		}
		logger.Info("history cleanup enabled", "expiration", r.historyExpiration.String())
	} else {
		logger.Info("history cleanup disabled", "history_expiration", r.historyExpiration.String())
	}
	// HistoryWriter can be either Loki or the API server
	// TODO: Loki configuration and setup in the same way we do for the API server
	// https://github.com/grafana/git-ui-sync-project/issues/508
	cleanup, err := controller.ProvideJobCleanup(common, nil, r.cleanupInterval)
	if err != nil {
		return err
	}

	// Start the historic-job source when history cleanup is enabled; cleanup runs
	// off its re-lists.
	if historySource != nil {
		go historySource.Run(ctx.Done())
	}

	ready()
	if err := cleanup.Run(ctx); err != nil {
		logger.Error("job cleanup controller failed", "error", err)
	}
	logger.Info("job cleanup controller stopped")
	// A failed cleanup pass must not take down history cleanup, so keep serving until shutdown.
	<-ctx.Done()
	return nil
}

type jobsRunner struct {
	*ProvisioningRunner
	historyExpiration time.Duration
	cleanupInterval   time.Duration
}

func newJobsRunner(rt *runner.Runtime) (*jobsRunner, error) {
	r, err := newProvisioningRunner(rt)
	if err != nil {
		return nil, err
	}

	operatorSec := rt.Cfg.SectionWithEnvOverrides("operator")

	return &jobsRunner{
		ProvisioningRunner: r,
		historyExpiration:  operatorSec.Key("history_expiration").MustDuration(0),
		cleanupInterval:    operatorSec.Key("cleanup_interval").MustDuration(time.Minute),
	}, nil
}
