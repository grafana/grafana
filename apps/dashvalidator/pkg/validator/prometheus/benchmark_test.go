package prometheus

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/cache"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
)

// availableMetrics simulates the metric names a real Prometheus instance would expose.
// Includes all metrics referenced by promQLPool in the validator benchmark, plus extras
// to simulate a realistic available-metrics set (typically thousands in production).
var availableMetrics = []string{
	"up",
	"http_requests_total",
	"container_cpu_usage_seconds_total",
	"http_request_duration_seconds_bucket",
	"node_memory_MemTotal_bytes",
	"node_memory_MemAvailable_bytes",
	"process_cpu_seconds_total",
	"node_cpu_seconds_total",
	"probe_duration_seconds",
	"prometheus_tsdb_head_samples_appended_total",
	"node_filesystem_size_bytes",
	"node_filesystem_free_bytes",
	"grpc_server_handled_total",
	"kube_pod_container_status_restarts_total",
	"container_memory_working_set_bytes",
	"kubelet_running_pods",
	"coredns_dns_request_duration_seconds_count",
	"etcd_server_has_leader",
	"scheduler_e2e_scheduling_duration_seconds_count",
	"apiserver_request_total",
	"workqueue_depth",
}

// promQLPool mirrors the pool from validator/benchmark_test.go.
// Duplicated here because benchmark_test.go is in the validator package (test-only, not exported).
var promQLPool = []string{
	`up{job="api"}`,
	`rate(http_requests_total{job="api", method="GET"}[$__rate_interval])`,
	`sum(rate(container_cpu_usage_seconds_total{namespace="default"}[5m])) by (pod)`,
	`histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`,
	`node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes`,
	`process_cpu_seconds_total`,
	`sum by (instance) (irate(node_cpu_seconds_total{mode!="idle"}[$__rate_interval]))`,
	`increase(http_requests_total{status=~"5.."}[5m])`,
	`avg_over_time(probe_duration_seconds[5m])`,
	`rate(prometheus_tsdb_head_samples_appended_total[$__rate_interval])`,
	`(node_filesystem_size_bytes{fstype!~"tmpfs|overlay"} - node_filesystem_free_bytes{fstype!~"tmpfs|overlay"}) / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}`,
	`sum(rate(grpc_server_handled_total{grpc_code!="OK"}[5m])) / sum(rate(grpc_server_handled_total[5m]))`,
	`kube_pod_container_status_restarts_total`,
	`container_memory_working_set_bytes{container!=""}`,
	`kubelet_running_pods`,
	`coredns_dns_request_duration_seconds_count`,
	`etcd_server_has_leader`,
	`scheduler_e2e_scheduling_duration_seconds_count`,
	`apiserver_request_total{code=~"2.."}`,
	`workqueue_depth{name="resource_quota"}`,
}

// buildQueries creates a slice of validator.Query with realistic PromQL expressions.
// Queries are selected round-robin from promQLPool (deterministic, no randomness).
func buildQueries(count int) []validator.Query {
	queries := make([]validator.Query, count)
	for i := range count {
		queries[i] = validator.Query{
			RefID:      string(rune('A' + i%26)),
			QueryText:  promQLPool[i%len(promQLPool)],
			PanelTitle: fmt.Sprintf("Panel %d", i/4+1),
			PanelID:    i/4 + 1,
		}
	}
	return queries
}

// newBenchmarkValidator creates a Validator with the real PromQL parser
// and a mock provider that returns availableMetrics instantly.
func newBenchmarkValidator() *Validator {
	mockProv := &mockProvider{
		metricsToReturn: availableMetrics,
		ttl:             5 * time.Minute,
	}
	metricsCache := cache.NewMetricsCache()
	metricsCache.RegisterProvider("prometheus", mockProv)
	return &Validator{
		parser: NewParser(),
		cache:  metricsCache,
	}
}

// buildLargeMetricsList generates a realistic metric name list of the given size.
// Metric names follow Prometheus naming conventions (e.g., "namespace_subsystem_name_unit").
// The first len(availableMetrics) entries are real metric names so dashboard queries
// will find matches; the rest are generated filler metrics.
func buildLargeMetricsList(count int) []string {
	metrics := make([]string, count)
	// Start with real metrics so queries find matches
	copy(metrics, availableMetrics)
	// Fill the rest with realistic-looking generated names
	for i := len(availableMetrics); i < count; i++ {
		metrics[i] = fmt.Sprintf("app_%d_http_requests_total", i)
	}
	return metrics
}

// newBenchmarkValidatorWithMetrics creates a Validator with the real PromQL parser
// and a mock provider that returns the given metrics list.
func newBenchmarkValidatorWithMetrics(metrics []string) *Validator {
	mockProv := &mockProvider{
		metricsToReturn: metrics,
		ttl:             5 * time.Minute,
	}
	metricsCache := cache.NewMetricsCache()
	metricsCache.RegisterProvider("prometheus", mockProv)
	return &Validator{
		parser: NewParser(),
		cache:  metricsCache,
	}
}

// BenchmarkValidateQueries_LargeMetricsList measures memory and latency when the
// Prometheus instance exposes a large number of metrics. This simulates real-world
// scenarios where Prometheus/Mimir instances have 10K-500K metric names.
//
// Before the GetMetricsSet optimization, fetchAvailableMetrics rebuilt a map[string]bool
// on every call (~28MB for 500K metrics). This benchmark validates that the cached-set
// approach eliminates that per-call overhead — memory should be flat regardless of
// metrics list size.
func BenchmarkValidateQueries_LargeMetricsList(b *testing.B) {
	cases := []struct {
		metricsCount int
	}{
		{1_000},   // Small Prometheus
		{10_000},  // Medium Prometheus
		{100_000}, // Large Prometheus / Cortex
		{500_000}, // Very large Mimir cluster
	}

	queries := buildQueries(100) // Fixed 100 queries, vary the metrics list size
	ds := validator.Datasource{
		UID:  "bench-prom",
		Type: "prometheus",
		Name: "Benchmark Prometheus",
		URL:  "http://localhost:9090",
	}

	for _, tc := range cases {
		metrics := buildLargeMetricsList(tc.metricsCount)
		name := fmt.Sprintf("metrics=%dk", tc.metricsCount/1000)

		b.Run(name, func(b *testing.B) {
			v := newBenchmarkValidatorWithMetrics(metrics)
			ctx := context.Background()
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				_, _ = v.ValidateQueries(ctx, queries, ds)
			}
		})
	}
}

// BenchmarkValidateQueries_Parallel measures throughput under concurrent load.
// All goroutines share a single Validator instance (same as production).
// Compares against BenchmarkValidateQueries to reveal lock contention or scaling issues.
func BenchmarkValidateQueries_Parallel(b *testing.B) {
	cases := []struct {
		queryCount int
	}{
		{10},
		{100},
		{400},
	}

	ds := validator.Datasource{
		UID:  "bench-prom",
		Type: "prometheus",
		Name: "Benchmark Prometheus",
		URL:  "http://localhost:9090",
	}

	for _, tc := range cases {
		queries := buildQueries(tc.queryCount)
		name := fmt.Sprintf("queries=%d", tc.queryCount)

		b.Run(name, func(b *testing.B) {
			v := newBenchmarkValidator()
			ctx := context.Background()
			b.ReportAllocs()
			b.ResetTimer()
			b.RunParallel(func(pb *testing.PB) {
				for pb.Next() {
					_, _ = v.ValidateQueries(ctx, queries, ds)
				}
			})
		})
	}
}

// BenchmarkValidateQueries measures the full Prometheus validation stage:
// PromQL parsing → metric extraction → metric comparison → scoring.
// Uses the real PromQL parser (actual AST walking), mock metrics provider.
func BenchmarkValidateQueries(b *testing.B) {
	cases := []struct {
		queryCount int
	}{
		{10},
		{50},
		{100},
		{400},
	}

	ds := validator.Datasource{
		UID:  "bench-prom",
		Type: "prometheus",
		Name: "Benchmark Prometheus",
		URL:  "http://localhost:9090",
	}

	for _, tc := range cases {
		queries := buildQueries(tc.queryCount)
		name := fmt.Sprintf("queries=%d", tc.queryCount)

		b.Run(name, func(b *testing.B) {
			v := newBenchmarkValidator()
			ctx := context.Background()
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				_, _ = v.ValidateQueries(ctx, queries, ds)
			}
		})
	}
}
