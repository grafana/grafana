package folders

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateOnDeleteRecordsOutcome(t *testing.T) {
	zero := int64(0)
	folder := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "nnn"}}
	stats := func(resource string, count int64) *mockSearchClient {
		return &mockSearchClient{stats: &resourcepb.ResourceStatsResponse{
			Stats: []*resourcepb.ResourceStatsResponse_Stats{{Resource: resource, Count: count}},
		}}
	}

	tests := []struct {
		name         string
		searcher     *mockSearchClient
		options      *metav1.DeleteOptions
		cascade      bool
		legacyJoin   bool
		wantOutcome  string
		wantJoin     string
		wantBlocking string
	}{
		{name: "empty folder", searcher: stats("alertrules", 0), legacyJoin: true, wantOutcome: "allowed", wantJoin: "enabled", wantBlocking: "none"},
		{name: "empty folder without the legacy join", searcher: stats("alertrules", 0), wantOutcome: "allowed", wantJoin: "disabled", wantBlocking: "none"},
		{name: "blocked by alert rules", searcher: stats("alertrules", 3), legacyJoin: true, wantOutcome: "refused_not_empty", wantJoin: "enabled", wantBlocking: "alertrules"},
		{name: "blocked by library panels", searcher: stats("librarypanels", 1), wantOutcome: "refused_not_empty", wantJoin: "disabled", wantBlocking: "librarypanels"},
		{name: "count failed", searcher: &mockSearchClient{statsErr: errors.New("boom")}, legacyJoin: true, wantOutcome: "refused_count_failed", wantJoin: "enabled", wantBlocking: "none"},
		{name: "count canceled by the caller", searcher: &mockSearchClient{statsErr: context.Canceled}, legacyJoin: true, wantOutcome: "refused_count_canceled", wantJoin: "enabled", wantBlocking: "none"},
		{name: "count timed out is still a failure", searcher: &mockSearchClient{statsErr: context.DeadlineExceeded}, legacyJoin: true, wantOutcome: "refused_count_failed", wantJoin: "enabled", wantBlocking: "none"},
		{name: "forced cascade delete", searcher: stats("alertrules", 3), options: &metav1.DeleteOptions{GracePeriodSeconds: &zero}, cascade: true, legacyJoin: true, wantOutcome: "bypassed_force_delete", wantJoin: "enabled", wantBlocking: "none"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			m := newDeleteCheckMetrics(reg, tt.legacyJoin)

			_ = validateOnDelete(context.Background(), folder, tt.searcher, tt.options, tt.cascade, m)

			require.Equal(t, 1.0, testutil.ToFloat64(m.checks.WithLabelValues(tt.wantOutcome, tt.wantJoin, tt.wantBlocking, "false")))
			require.Equal(t, 1, recordedSeries(t, m.checks), "only one series should have been recorded")
		})
	}
}

func TestValidateOnDeleteBlockingKindIgnoresStatsOrder(t *testing.T) {
	folder := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "nnn"}}
	stat := func(resource string, count int64) *resourcepb.ResourceStatsResponse_Stats {
		return &resourcepb.ResourceStatsResponse_Stats{Resource: resource, Count: count}
	}
	orders := map[string][]*resourcepb.ResourceStatsResponse_Stats{
		"dashboards first":  {stat("dashboards", 2), stat("alertrules", 3), stat("folders", 0)},
		"alert rules first": {stat("folders", 0), stat("alertrules", 3), stat("dashboards", 2)},
	}
	for name, order := range orders {
		t.Run(name, func(t *testing.T) {
			m := newDeleteCheckMetrics(prometheus.NewRegistry(), true)
			searcher := &mockSearchClient{stats: &resourcepb.ResourceStatsResponse{Stats: order}}

			err := validateOnDelete(context.Background(), folder, searcher, nil, false, m)

			require.ErrorContains(t, err, "contains 3 alertrules")
			require.Equal(t, 1.0, testutil.ToFloat64(m.checks.WithLabelValues("refused_not_empty", "enabled", "alertrules", "false")))
			require.Equal(t, 1, recordedSeries(t, m.checks))
		})
	}
}

func TestValidateLabelsDryRunDeletes(t *testing.T) {
	setKubernetesFolderCascadeDeleteToggle(t, false)
	m := newDeleteCheckMetrics(prometheus.NewRegistry(), true)
	b := &FolderAPIBuilder{
		searcher:     &mockSearchClient{stats: &resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{}}},
		deleteChecks: m,
	}
	obj := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "nnn", Namespace: "default"}}
	validate := func(dryRun bool) {
		t.Helper()
		err := b.Validate(context.Background(), admission.NewAttributesRecord(nil, obj,
			folders.SchemeGroupVersion.WithKind("folder"), obj.Namespace, obj.Name,
			folders.SchemeGroupVersion.WithResource("folders"), "", admission.Delete,
			&metav1.DeleteOptions{}, dryRun, &user.SignedInUser{}), nil)
		require.NoError(t, err)
	}

	validate(true)
	validate(false)
	validate(false)

	require.Equal(t, 1.0, testutil.ToFloat64(m.checks.WithLabelValues("allowed", "enabled", "none", "true")))
	require.Equal(t, 2.0, testutil.ToFloat64(m.checks.WithLabelValues("allowed", "enabled", "none", "false")))
	require.Equal(t, 2, recordedSeries(t, m.checks), "dry runs and real deletes are separate series")
}

func TestDryRunCountFailureIsStillRecorded(t *testing.T) {
	m := newDeleteCheckMetrics(prometheus.NewRegistry(), true).withDryRun(true)
	folder := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "nnn"}}

	_ = validateOnDelete(context.Background(), folder, &mockSearchClient{statsErr: errors.New("boom")}, nil, false, m)

	require.Equal(t, 1.0, testutil.ToFloat64(m.checks.WithLabelValues("refused_count_failed", "enabled", "none", "true")))
}

func TestDeleteCheckMetricsRegistration(t *testing.T) {
	t.Run("a nil registerer records without registering", func(t *testing.T) {
		m := newDeleteCheckMetrics(nil, true)
		require.NotPanics(t, func() { m.withDryRun(true).record(deleteCheckAllowed, blockingKindNone) })
	})

	t.Run("a nil recorder records nothing", func(t *testing.T) {
		var m *deleteCheckMetrics
		require.NotPanics(t, func() { m.withDryRun(true).record(deleteCheckAllowed, blockingKindNone) })
	})

	t.Run("registering twice on one registry fails loudly", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		require.NotNil(t, newDeleteCheckMetrics(reg, true))
		require.Panics(t, func() { newDeleteCheckMetrics(reg, true) })
	})
}

// recordedSeries counts the series that have observations. Series are created at zero up front.
func recordedSeries(t *testing.T, c prometheus.Collector) int {
	t.Helper()
	ch := make(chan prometheus.Metric, 128)
	go func() { c.Collect(ch); close(ch) }()
	n := 0
	for m := range ch {
		var d dto.Metric
		require.NoError(t, m.Write(&d))
		if d.GetCounter().GetValue() > 0 {
			n++
		}
	}
	return n
}

func TestMetricsExistBeforeAnyObservation(t *testing.T) {
	t.Run("delete checks", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		newDeleteCheckMetrics(reg, true)
		n, err := testutil.GatherAndCount(reg, "grafana_folder_delete_checks_total")
		require.NoError(t, err)
		require.Equal(t, 8, n, "4 outcomes x dry_run")
	})
	t.Run("count requests", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		newCountMetrics(reg, true)
		n, err := testutil.GatherAndCount(reg, "grafana_folder_counts_requests_total")
		require.NoError(t, err)
		require.Equal(t, 6, n, "2 callers x 3 outcomes")
	})
}
