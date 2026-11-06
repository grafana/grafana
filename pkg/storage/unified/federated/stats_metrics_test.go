package federated

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// observations returns how many durations were recorded for the labels.
func observations(t *testing.T, reg *prometheus.Registry, name, outcome string) uint64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() != "grafana_folder_counts_legacy_query_duration_seconds" {
			continue
		}
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["resource"] == name && labels["outcome"] == outcome {
				return m.GetHistogram().GetSampleCount()
			}
		}
	}
	t.Fatalf("no series for %s/%s", name, outcome)
	return 0
}

func TestLegacyStatsMetricsObserveOutcome(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{name: "success", want: legacyOutcomeOK},
		{name: "failure", err: errors.New("boom"), want: legacyOutcomeError},
		{name: "timeout is a failure", err: context.DeadlineExceeded, want: legacyOutcomeError},
		{name: "wrapped cancellation", err: fmt.Errorf("query: %w", context.Canceled), want: legacyOutcomeCanceled},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			m := newLegacyStatsMetrics(reg)

			m.observe(legacyAlertRules, time.Now(), tt.err)

			for _, outcome := range legacyOutcomes {
				want := uint64(0)
				if outcome == tt.want {
					want = 1
				}
				require.Equal(t, want, observations(t, reg, legacyAlertRules, outcome), outcome)
			}
			require.Equal(t, uint64(0), observations(t, reg, legacyRecordingRules, tt.want), "other resources are untouched")
		})
	}
}

func TestLegacyStatsMetricsExistBeforeAnyObservation(t *testing.T) {
	reg := prometheus.NewRegistry()
	newLegacyStatsMetrics(reg)

	n, err := testutil.GatherAndCount(reg, "grafana_folder_counts_legacy_query_duration_seconds")
	require.NoError(t, err)
	require.Equal(t, 9, n, "3 resources x 3 outcomes")
	n, err = testutil.GatherAndCount(reg, "grafana_folder_counts_legacy_skipped_total")
	require.NoError(t, err)
	require.Equal(t, 6, n, "3 resources x 2 reasons")
}

func TestLegacyStatsMetricsNilRecordsNothing(t *testing.T) {
	var m *legacyStatsMetrics
	require.NotPanics(t, func() {
		m.observe(legacyAlertRules, time.Now(), nil)
		m.skip(legacyAlertRules, legacySkipMigrated)
	})
	require.NotNil(t, newLegacyStatsMetrics(nil), "a nil registerer still records, unregistered")
}

func TestFederatedGetStatsCountsSkippedForDeletedNamespace(t *testing.T) {
	reg := prometheus.NewRegistry()
	base := resource.NewMockResourceClient(t)
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
	client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, fmt.Errorf("lookup stack: %w", legacysql.ErrNamespaceDeleted)
	}, nil, WithMetrics(reg))

	_, err := client.GetStats(t.Context(), in)
	require.NoError(t, err)

	for _, name := range legacyResources {
		c := client.(*federatedClient).stats.metrics.skipped.WithLabelValues(name, legacySkipNamespaceDeleted)
		require.Equal(t, 1.0, testutil.ToFloat64(c), name)
	}
}
