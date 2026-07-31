package diagnostics

import (
	"context"
	"sync"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestMetricsConcurrentInstancesDoNotLoseIncrements(t *testing.T) {
	ctx := context.Background()
	sqlStore := db.InitTestDB(t)
	clearDiagnosticsMetrics(t, sqlStore)
	firstUsage := &usagestats.UsageStatsMock{T: t}
	secondUsage := &usagestats.UsageStatsMock{T: t}
	first := NewMetrics(sqlStore, firstUsage, prometheus.NewPedanticRegistry())
	second := NewMetrics(sqlStore, secondUsage, prometheus.NewPedanticRegistry())

	const incrementsPerInstance = 20
	var wg sync.WaitGroup
	for i := range incrementsPerInstance * 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if i%2 == 0 {
				first.RecordStarted(ctx, ScopeDashboard)
				return
			}
			second.RecordStarted(ctx, ScopeDashboard)
		}()
	}
	wg.Wait()

	report, err := firstUsage.GetUsageReport(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(incrementsPerInstance*2), report.Metrics["stats.ds_diagnostics.dashboard_runs.count"])
}

func TestMetricsPublishesPersistedUsageStats(t *testing.T) {
	ctx := context.Background()
	store := newMemoryCounterStore()
	usage := &usagestats.UsageStatsMock{T: t}
	metrics := newMetrics(store, usage, prometheus.NewPedanticRegistry())

	metrics.RecordStarted(ctx, ScopePanel)
	metrics.RecordStarted(ctx, ScopeDashboard)
	metrics.RecordCompleted(ctx, ScopePanel, ResultError)

	report, err := usage.GetUsageReport(ctx)
	require.NoError(t, err)
	require.Equal(t, map[string]any{
		"stats.ds_diagnostics.panel_runs.count":       int64(1),
		"stats.ds_diagnostics.panel_errors.count":     int64(1),
		"stats.ds_diagnostics.dashboard_runs.count":   int64(1),
		"stats.ds_diagnostics.dashboard_errors.count": int64(0),
	}, report.Metrics)
}

func TestMetricsPersistsUsageStatsAfterRequestCancellation(t *testing.T) {
	requestCtx, cancel := context.WithCancel(context.Background())
	cancel()
	store := newMemoryCounterStore()
	usage := &usagestats.UsageStatsMock{T: t}
	metrics := newMetrics(store, usage, prometheus.NewPedanticRegistry())

	metrics.RecordStarted(requestCtx, ScopePanel)
	metrics.RecordCompleted(requestCtx, ScopePanel, ResultError)

	report, err := usage.GetUsageReport(context.Background())
	require.NoError(t, err)
	require.Equal(t, int64(1), report.Metrics["stats.ds_diagnostics.panel_runs.count"])
	require.Equal(t, int64(1), report.Metrics["stats.ds_diagnostics.panel_errors.count"])
}

func TestMetricsCountersSurviveRecreation(t *testing.T) {
	ctx := context.Background()
	sqlStore := db.InitTestDB(t)
	clearDiagnosticsMetrics(t, sqlStore)
	firstUsage := &usagestats.UsageStatsMock{T: t}
	first := NewMetrics(sqlStore, firstUsage, prometheus.NewPedanticRegistry())
	first.RecordStarted(ctx, ScopePanel)

	secondUsage := &usagestats.UsageStatsMock{T: t}
	NewMetrics(sqlStore, secondUsage, prometheus.NewPedanticRegistry())
	report, err := secondUsage.GetUsageReport(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(1), report.Metrics["stats.ds_diagnostics.panel_runs.count"])
}

func clearDiagnosticsMetrics(t *testing.T, sqlStore db.DB) {
	t.Helper()
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
		_, err := session.Where("namespace = ?", metricsNamespace).Delete(&kvstore.Item{})
		return err
	}))
}

func TestMetricsConcurrentIncrementsAreNotLost(t *testing.T) {
	ctx := context.Background()
	store := newMemoryCounterStore()
	usage := &usagestats.UsageStatsMock{T: t}
	metrics := newMetrics(store, usage, prometheus.NewPedanticRegistry())

	const increments = 50
	var wg sync.WaitGroup
	for range increments {
		wg.Add(1)
		go func() {
			defer wg.Done()
			metrics.RecordStarted(ctx, ScopeDashboard)
		}()
	}
	wg.Wait()

	report, err := usage.GetUsageReport(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(increments), report.Metrics["stats.ds_diagnostics.dashboard_runs.count"])
}

func TestMetricsExposesTerminalResultsToPrometheus(t *testing.T) {
	ctx := context.Background()
	registry := prometheus.NewPedanticRegistry()
	metrics := newMetrics(newMemoryCounterStore(), &usagestats.UsageStatsMock{T: t}, registry)

	metrics.RecordCompleted(ctx, ScopePanel, ResultSuccess)
	metrics.RecordCompleted(ctx, ScopeDashboard, ResultError)

	require.Equal(t, float64(1), testutil.ToFloat64(metrics.runs.WithLabelValues("panel", "success")))
	require.Equal(t, float64(1), testutil.ToFloat64(metrics.runs.WithLabelValues("dashboard", "error")))
}

type memoryCounterStore struct {
	mu     sync.Mutex
	values map[string]int64
}

func newMemoryCounterStore() *memoryCounterStore {
	return &memoryCounterStore{values: map[string]int64{}}
}

func (s *memoryCounterStore) Increment(ctx context.Context, key string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.values[key]++
	return nil
}

func (s *memoryCounterStore) Read(_ context.Context, key string) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.values[key], nil
}
