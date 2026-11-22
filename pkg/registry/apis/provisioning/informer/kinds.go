package informer

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/controllerapp"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/jobs"
	"github.com/grafana/grafana/pkg/infra/nats"
)

// JobQueueKind feeds the driver's work queue with live job events and with the
// source's periodic resync or re-list, which re-delivers unclaimed jobs
// (rolled-back claims, dropped keys, missed notifications) and is the driver's
// only recovery path for them. The resync is the job pickup interval.
func JobQueueKind(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, reg prometheus.Registerer, driver *jobs.ConcurrentJobDriver) controllerapp.WatchedKind {
	return controllerapp.WatchedKind{
		Info:    provisioning.JobResourceInfo,
		Source:  NewJobDeltaSource(subscriber, client, resync, reg),
		Handler: driver.EventHandler(),
	}
}

// HistoricJobsKind deletes historic jobs older than expiration. Cleanup is
// age-based and needs no live events: with NATS off the source is an
// apiserver informer (watch-fed cache replayed on resync), with NATS on it is
// a cron-style periodic re-list. Either way each pass delivers every historic
// job to the handler.
func HistoricJobsKind(client versioned.Interface, natsEnabled bool, expiration time.Duration) controllerapp.WatchedKind {
	return controllerapp.WatchedKind{
		Info:    provisioning.HistoricJobResourceInfo,
		Source:  NewHistoricJobDeltaSource(natsEnabled, client, expiration),
		Handler: appcontroller.NewHistoryJobController(client.ProvisioningV0alpha1(), expiration).EventHandler(),
	}
}
