package repository

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Operation labels for the repository operation metrics. Reads and writes carry
// a byte payload and are observed on the size histogram too; the rest only
// record duration and outcome.
const (
	OperationRead   = "read"
	OperationWrite  = "write"
	OperationList   = "list"
	OperationDelete = "delete"
	OperationMove   = "move"
	OperationPush   = "push"
)

// OperationMetrics tracks the work repositories do on behalf of their callers:
// size (where there is a byte payload), duration and outcome, per operation and
// repository type. The repository implementations record it themselves, behind
// the Repository interface, so every caller — job execution, the files API, the
// parser, the authorizer, sync compare/diff, ... — is covered without having to
// opt in.
//
// One caveat when reading the write series: a staged repository only stages
// blobs locally, so a staged write's duration covers the staging and its
// outcome reports whether staging succeeded. The commit and the remote round
// trip happen once, at the end, and are recorded separately as OperationPush —
// that is where the network cost of a staged batch lives, and where a batch
// that never reached the remote shows up as a failure.
type OperationMetrics struct {
	sizeHist     *prometheus.HistogramVec // operation, repository_type
	durationHist *prometheus.HistogramVec // operation, repository_type
	opsTotal     *prometheus.CounterVec   // operation, repository_type, outcome
}

var (
	operationMetricsOnce sync.Once
	operationMetrics     *OperationMetrics
)

// RegisterOperationMetrics registers the repository operation metrics.
func RegisterOperationMetrics(reg prometheus.Registerer) *OperationMetrics {
	operationMetricsOnce.Do(func() {
		sizeHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_provisioning_repository_operation_size_bytes",
				Help: "Size in bytes of repository operations that carry a byte payload (read, write)",
				// 128B -> 64MB. Deliberately well above ProvisioningMaxFileSizeDefault (5MiB)
				// so the configured cap sits mid-histogram instead of at the +Inf edge.
				Buckets: prometheus.ExponentialBuckets(128, 2, 20),
			},
			[]string{"operation", "repository_type"},
		)
		reg.MustRegister(sizeHist)

		durationHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_repository_operation_duration_seconds",
				Help:    "Duration of repository operations",
				Buckets: prometheus.ExponentialBucketsRange(0.001, 30, 10), // 1ms -> 30s
			},
			[]string{"operation", "repository_type"},
		)
		reg.MustRegister(durationHist)

		opsTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_repository_operations_total",
				Help: "Total repository operations, by outcome",
			},
			[]string{"operation", "repository_type", "outcome"},
		)
		reg.MustRegister(opsTotal)

		operationMetrics = &OperationMetrics{
			sizeHist:     sizeHist,
			durationHist: durationHist,
			opsTotal:     opsTotal,
		}
	})
	return operationMetrics
}

// Recorder returns a recorder that labels everything it observes with repoType,
// for a repository implementation to hold for its lifetime. A nil
// *OperationMetrics yields a nil recorder, whose methods do nothing, so
// repositories built without metrics (tests, dev tooling) work unchanged.
func (m *OperationMetrics) Recorder(repoType provisioning.RepositoryType) *OperationRecorder {
	if m == nil {
		return nil
	}
	return &OperationRecorder{metrics: m, repoType: string(repoType)}
}

// OperationRecorder records the operations of a single repository. The nil
// recorder is usable and records nothing.
type OperationRecorder struct {
	metrics  *OperationMetrics
	repoType string
}

// Read records a read that started at start. info may be nil, which is how a
// failed read reports "no data".
func (r *OperationRecorder) Read(start time.Time, info *FileInfo, err error) {
	size := 0
	if info != nil {
		size = len(info.Data)
	}
	r.recordSize(OperationRead, start, size, err)
}

// Write records a write of sizeBytes that started at start.
func (r *OperationRecorder) Write(start time.Time, sizeBytes int, err error) {
	r.recordSize(OperationWrite, start, sizeBytes, err)
}

// List records a tree listing that started at start.
func (r *OperationRecorder) List(start time.Time, err error) {
	r.recordOutcome(OperationList, start, err)
}

// Delete records a delete that started at start.
func (r *OperationRecorder) Delete(start time.Time, err error) {
	r.recordOutcome(OperationDelete, start, err)
}

// Move records a move that started at start.
func (r *OperationRecorder) Move(start time.Time, err error) {
	r.recordOutcome(OperationMove, start, err)
}

// Push records a staged batch being committed and pushed to the remote, which
// is the point at which the writes staged before it actually land.
func (r *OperationRecorder) Push(start time.Time, err error) {
	r.recordOutcome(OperationPush, start, err)
}

func (r *OperationRecorder) recordSize(operation string, start time.Time, sizeBytes int, err error) {
	if r == nil {
		return
	}
	r.recordOutcome(operation, start, err)
	// Size is only meaningful once the data is actually known good; a failed
	// read/write has no reliable size and would otherwise skew the low end of
	// the histogram with zeroes.
	if err == nil {
		r.metrics.sizeHist.WithLabelValues(operation, r.repoType).Observe(float64(sizeBytes))
	}
}

func (r *OperationRecorder) recordOutcome(operation string, start time.Time, err error) {
	if r == nil {
		return
	}

	outcome := "success"
	if err != nil {
		outcome = "error"
	}

	r.metrics.opsTotal.WithLabelValues(operation, r.repoType, outcome).Inc()
	r.metrics.durationHist.WithLabelValues(operation, r.repoType).Observe(time.Since(start).Seconds())
}
