package controllerapp

import (
	"context"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

// JobQueue feeds the driver's work queue with live job events and with the
// source's periodic resync or re-list, which re-delivers unclaimed jobs
// (rolled-back claims, dropped keys, missed notifications) and is the driver's
// only recovery path for them. The resync is the job pickup interval.
func JobQueue(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, reg prometheus.Registerer, driver *jobs.ConcurrentJobDriver) WatchedKind {
	return WatchedKind{
		Info:    provisioning.JobResourceInfo,
		Source:  informer.NewJobDeltaSource(subscriber, client, resync, reg),
		Handler: driver.EventHandler(),
	}
}

// HistoricJobs deletes historic jobs older than expiration. Cleanup is
// age-based and needs no live events: with NATS off the source is an
// apiserver informer (watch-fed cache replayed on resync), with NATS on it is
// a cron-style periodic re-list. Either way each pass delivers every historic
// job to the handler.
func HistoricJobs(client versioned.Interface, natsEnabled bool, expiration time.Duration) WatchedKind {
	return WatchedKind{
		Info:    provisioning.HistoricJobResourceInfo,
		Source:  informer.NewHistoricJobDeltaSource(natsEnabled, client, expiration),
		Handler: appcontroller.NewHistoryJobController(client.ProvisioningV0alpha1(), expiration).EventHandler(),
	}
}

// LogErrors runs a long-lived loop, such as the job driver or the expired-job
// cleanup, as an app runnable. Its failure is logged rather than returned, so
// it does not stop the app's other controllers.
func LogErrors(logger logging.Logger, name string, run func(ctx context.Context) error) RunnableFunc {
	return func(ctx context.Context) error {
		if err := run(ctx); err != nil {
			logger.Error(name+" failed", "error", err)
		}
		logger.Info(name + " stopped")
		return nil
	}
}
