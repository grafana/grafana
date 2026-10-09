package metrics

import (
	"slices"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestIndexMetricsSharesBuildCollectors(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := ProvideIndexMetrics(reg)
	require.Same(t, metrics.BuildMetrics, metrics.BleveMetrics.BuildMetrics)
	require.Same(t, metrics.BuildMetrics, metrics.ServiceMetrics.BuildMetrics)
	labels := []string{IndexPhaseConvert, IndexPathBuild, "group", "resources"}
	metrics.ServiceMetrics.BuildDocuments.WithLabelValues(labels...).Add(2)
	metrics.BleveMetrics.BuildDocuments.WithLabelValues(labels...).Add(3)
	require.Equal(t, 5.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(labels...)))
	_, err := reg.Gather()
	require.NoError(t, err)
}

func TestMetricOwnersRegisterOnlyTheirFamilies(t *testing.T) {
	for _, tc := range []struct {
		name            string
		provide         func(prometheus.Registerer)
		present, absent string
	}{
		{"bleve", func(reg prometheus.Registerer) { ProvideBleveMetrics(reg, nil) }, "grafana_index_server_index_size_bytes", "grafana_index_server_rebuild_queue_length"},
		{"service", func(reg prometheus.Registerer) { ProvideServiceMetrics(reg, nil) }, "grafana_index_server_rebuild_queue_length", "grafana_index_server_index_size_bytes"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reg := prometheus.NewPedanticRegistry()
			tc.provide(reg)
			families, err := reg.Gather()
			require.NoError(t, err)
			var names []string
			for _, family := range families {
				names = append(names, family.GetName())
			}
			require.True(t, slices.Contains(names, tc.present))
			require.False(t, slices.Contains(names, tc.absent))
		})
	}
}

func TestIndexMetricsInitialSeries(t *testing.T) {
	metrics := ProvideIndexMetrics(prometheus.NewRegistry())
	require.Equal(t, 2, testutil.CollectAndCount(metrics.OpenIndexes))
	require.Equal(t, 2, testutil.CollectAndCount(metrics.SearchResultFormats))
	require.Equal(t, 2, testutil.CollectAndCount(metrics.SearchServicePermissionFailures))
	require.Equal(t, 1, testutil.CollectAndCount(metrics.ReconcileQueueLength))
	require.Zero(t, testutil.CollectAndCount(metrics.IndexSnapshotUploads))
	require.Zero(t, testutil.CollectAndCount(metrics.IndexDiskCleanupRuns))
	metrics.InitSnapshotMetrics()
	metrics.InitDiskCleanupMetrics()
	require.Equal(t, 7, testutil.CollectAndCount(metrics.IndexSnapshotUploads))
	require.Equal(t, 2, testutil.CollectAndCount(metrics.IndexDiskCleanupRuns))
}
