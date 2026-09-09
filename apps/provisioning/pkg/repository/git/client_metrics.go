package git

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/nanogit/metrics"
)

// ClientMetrics exposes the protocol/network-level signals nanogit reports
// through its metrics.Recorder interface: the HTTP round trips it makes to the
// Git server, the objects and bytes it fetches over the network, and the
// packfile cache lookups it does before deciding to fetch. These sit a layer
// below the repository operation metrics (OperationMetrics): a single Read or
// CompareFiles can drive several HTTP requests, retries and cache lookups, and
// this is where that cost becomes visible.
//
// The recorder is injected into the context nanogit operates on, so the git
// repository is instrumented without any change to nanogit call sites.
type ClientMetrics struct {
	httpRequests   *prometheus.CounterVec   // repository_type, operation, status_code
	httpDuration   *prometheus.HistogramVec // repository_type, operation
	httpRetries    *prometheus.CounterVec   // repository_type, operation
	objectsFetched *prometheus.CounterVec   // repository_type
	fetchedBytes   *prometheus.CounterVec   // repository_type
	cacheAccesses  *prometheus.CounterVec   // repository_type, result
}

var (
	clientMetricsOnce sync.Once
	clientMetrics     *ClientMetrics
)

// RegisterClientMetrics registers the nanogit client metrics against reg and
// stores them as the process-wide instance the git repositories report to. Like
// the other provisioning metric families it binds to the first registry it is
// given; subsequent calls return that same instance.
func RegisterClientMetrics(reg prometheus.Registerer) *ClientMetrics {
	clientMetricsOnce.Do(func() {
		clientMetrics = newClientMetrics(reg)
	})
	return clientMetrics
}

func newClientMetrics(reg prometheus.Registerer) *ClientMetrics {
	m := &ClientMetrics{
		httpRequests: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_git_client_http_requests_total",
				Help: "Total HTTP requests nanogit made to the Git server, by protocol operation and status code. Counts every attempt, including retries.",
			},
			[]string{"repository_type", "operation", "status_code"},
		),
		httpDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_git_client_http_request_duration_seconds",
				Help:    "Duration of the HTTP round trips nanogit made to the Git server, by protocol operation.",
				Buckets: prometheus.ExponentialBucketsRange(0.001, 30, 10), // 1ms -> 30s
			},
			[]string{"repository_type", "operation"},
		),
		httpRetries: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_git_client_http_retries_total",
				Help: "HTTP requests to the Git server that were retries (attempt > 1), by protocol operation.",
			},
			[]string{"repository_type", "operation"},
		),
		objectsFetched: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_git_client_objects_fetched_total",
				Help: "Total Git objects nanogit parsed from fetch responses.",
			},
			[]string{"repository_type"},
		),
		fetchedBytes: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_git_client_fetched_bytes_total",
				Help: "Total response bytes nanogit read while fetching objects.",
			},
			[]string{"repository_type"},
		),
		cacheAccesses: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_git_client_cache_accesses_total",
				Help: "Packfile object cache lookups nanogit did before deciding whether to fetch, by result (hit/miss).",
			},
			[]string{"repository_type", "result"},
		),
	}

	reg.MustRegister(
		m.httpRequests,
		m.httpDuration,
		m.httpRetries,
		m.objectsFetched,
		m.fetchedBytes,
		m.cacheAccesses,
	)
	return m
}

// Recorder returns a metrics.Recorder that labels everything it observes with
// repoType, for a repository to inject into the context nanogit operates on. A
// nil *ClientMetrics yields a nil recorder, so a repository built without
// metrics (tests, dev tooling) simply reports nothing.
func (m *ClientMetrics) Recorder(repoType provisioning.RepositoryType) metrics.Recorder {
	if m == nil {
		return nil
	}
	return &clientRecorder{metrics: m, repoType: string(repoType)}
}

// clientRecorder bridges nanogit's metrics.Recorder calls to the Prometheus
// vectors of a single repository. nanogit calls these methods inline on the
// request path, so they only touch counters/histograms and return promptly.
type clientRecorder struct {
	metrics  *ClientMetrics
	repoType string
}

func (r *clientRecorder) HTTPRequest(_ context.Context, operation metrics.Operation, statusCode int, duration time.Duration, attempt int) {
	r.metrics.httpRequests.WithLabelValues(r.repoType, operation, strconv.Itoa(statusCode)).Inc()
	r.metrics.httpDuration.WithLabelValues(r.repoType, operation).Observe(duration.Seconds())
	// attempt is 1-indexed, so anything past the first is a retry.
	if attempt > 1 {
		r.metrics.httpRetries.WithLabelValues(r.repoType, operation).Inc()
	}
}

func (r *clientRecorder) ObjectsFetched(_ context.Context, count int, bytes int64) {
	r.metrics.objectsFetched.WithLabelValues(r.repoType).Add(float64(count))
	r.metrics.fetchedBytes.WithLabelValues(r.repoType).Add(float64(bytes))
}

func (r *clientRecorder) CacheAccess(_ context.Context, hit bool) {
	result := "miss"
	if hit {
		result = "hit"
	}
	r.metrics.cacheAccesses.WithLabelValues(r.repoType, result).Inc()
}
