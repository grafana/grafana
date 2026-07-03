package jobs

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// knownJobActions is used to pre-seed the queue size gauge so that every
// action reports 0 instead of having no series at all.
var knownJobActions = []provisioning.JobAction{
	provisioning.JobActionPull,
	provisioning.JobActionPush,
	provisioning.JobActionPullRequest,
	provisioning.JobActionMigrate,
	provisioning.JobActionDelete,
	provisioning.JobActionMove,
	provisioning.JobActionFixFolderMetadata,
	provisioning.JobActionReleaseResources,
	provisioning.JobActionDeleteResources,
}

// QueueCounter counts active jobs grouped by action.
type QueueCounter interface {
	CountJobsByAction(ctx context.Context) (map[provisioning.JobAction]int, error)
}

// QueueSizeReporter periodically counts the jobs in the queue and reports the
// result as a gauge. It is the single source of truth for the queue size
// metric and must only run in one workload per deployment: counting the actual
// Job resources (rather than incrementing/decrementing on insert/complete
// events) keeps the value correct across process restarts and regardless of
// which process inserts or completes a job.
type QueueSizeReporter struct {
	counter  QueueCounter
	gauge    *prometheus.GaugeVec
	interval time.Duration

	// seen tracks every action ever reported so that actions outside
	// knownJobActions still drop to 0 once they leave the queue.
	seen map[provisioning.JobAction]struct{}
}

// NewQueueSizeReporter creates a reporter and registers the queue size gauge
// on the given registry.
func NewQueueSizeReporter(counter QueueCounter, registry prometheus.Registerer, interval time.Duration) *QueueSizeReporter {
	gauge := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_jobs_queue_size",
			Help: "Number of jobs currently in the queue",
		},
		[]string{"action"},
	)
	registry.MustRegister(gauge)

	seen := make(map[provisioning.JobAction]struct{}, len(knownJobActions))
	for _, action := range knownJobActions {
		gauge.WithLabelValues(string(action)).Set(0)
		seen[action] = struct{}{}
	}

	return &QueueSizeReporter{
		counter:  counter,
		gauge:    gauge,
		interval: interval,
		seen:     seen,
	}
}

// Run refreshes the gauge once and then on every interval tick. This is a
// blocking function that runs until the context is canceled.
func (r *QueueSizeReporter) Run(ctx context.Context) error {
	logger := logging.FromContext(ctx).With("logger", "queue-size-reporter")
	ctx = logging.Context(ctx, logger)

	logger.Debug("starting queue size reporter", "interval", r.interval)

	r.refresh(ctx)

	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.refresh(ctx)
		case <-ctx.Done():
			logger.Debug("queue size reporter stopping")
			return ctx.Err()
		}
	}
}

// refresh sets the gauge from the current job counts. On error the previous
// values are kept until the next tick.
func (r *QueueSizeReporter) refresh(ctx context.Context) {
	counts, err := r.counter.CountJobsByAction(ctx)
	if err != nil {
		logging.FromContext(ctx).Debug("failed to refresh job queue size", "error", err)
		return
	}

	for action := range counts {
		r.seen[action] = struct{}{}
	}
	for action := range r.seen {
		r.gauge.WithLabelValues(string(action)).Set(float64(counts[action]))
	}
}
