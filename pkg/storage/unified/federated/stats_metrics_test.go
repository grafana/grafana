package federated

import (
	"context"
	"errors"
	"fmt"
	"strings"
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
func observations(t *testing.T, reg *prometheus.Registry, resourceName, outcome string) uint64 {
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
			if labels["resource"] == resourceName && labels["outcome"] == outcome {
				return m.GetHistogram().GetSampleCount()
			}
		}
	}
	t.Fatalf("no series for %s/%s", resourceName, outcome)
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

// seriesOf lists the label values of every series of a metric, joined as "resource/other".
func seriesOf(t *testing.T, reg *prometheus.Registry, metric, otherLabel string) []string {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	var out []string
	for _, f := range families {
		if f.GetName() != metric {
			continue
		}
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			out = append(out, labels["resource"]+"/"+labels[otherLabel])
		}
	}
	return out
}

func TestLegacyStatsMetricsExistBeforeAnyObservation(t *testing.T) {
	reg := prometheus.NewRegistry()
	newLegacyStatsMetrics(reg)

	require.ElementsMatch(t, []string{
		"alertrules/ok", "alertrules/error", "alertrules/canceled",
		"recordingrules/ok", "recordingrules/error", "recordingrules/canceled",
		"library_elements/ok", "library_elements/error", "library_elements/canceled",
	}, seriesOf(t, reg, "grafana_folder_counts_legacy_query_duration_seconds", "outcome"))
	require.ElementsMatch(t, []string{
		"alertrules/migrated", "alertrules/namespace_deleted",
		"recordingrules/migrated", "recordingrules/namespace_deleted",
		"library_elements/migrated", "library_elements/namespace_deleted",
	}, seriesOf(t, reg, "grafana_folder_counts_legacy_skipped_total", "reason"))
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

	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(`
# HELP grafana_folder_counts_legacy_skipped_total Legacy database counts that were not run, by resource and reason
# TYPE grafana_folder_counts_legacy_skipped_total counter
grafana_folder_counts_legacy_skipped_total{reason="migrated",resource="alertrules"} 0
grafana_folder_counts_legacy_skipped_total{reason="migrated",resource="library_elements"} 0
grafana_folder_counts_legacy_skipped_total{reason="migrated",resource="recordingrules"} 0
grafana_folder_counts_legacy_skipped_total{reason="namespace_deleted",resource="alertrules"} 1
grafana_folder_counts_legacy_skipped_total{reason="namespace_deleted",resource="library_elements"} 1
grafana_folder_counts_legacy_skipped_total{reason="namespace_deleted",resource="recordingrules"} 1
`), "grafana_folder_counts_legacy_skipped_total"))
}

func TestFederatedGetStatsRecordsLegacyAccessFailures(t *testing.T) {
	tests := []struct {
		name     string
		provider legacysql.LegacyDatabaseProvider
		want     string
	}{
		{name: "no legacy source", provider: nil, want: legacyOutcomeError},
		{name: "provider failure", provider: func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return nil, errors.New("connect: refused")
		}, want: legacyOutcomeError},
		{name: "caller went away during the lookup", provider: func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return nil, fmt.Errorf("lookup stack: %w", context.Canceled)
		}, want: legacyOutcomeCanceled},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			base := resource.NewMockResourceClient(t)
			in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
			base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
			client := NewFederatedClient(base, tt.provider, nil, WithMetrics(reg))

			_, err := client.GetStats(t.Context(), in)
			require.Error(t, err)

			for _, name := range legacyResources {
				require.Equal(t, uint64(1), observations(t, reg, name, tt.want), name)
				require.Equal(t, uint64(0), observations(t, reg, name, legacyOutcomeOK), name)
			}
		})
	}
}
