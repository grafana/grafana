package folders

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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
		{name: "forced cascade delete", searcher: stats("alertrules", 3), options: &metav1.DeleteOptions{GracePeriodSeconds: &zero}, cascade: true, legacyJoin: true, wantOutcome: "bypassed_force_delete", wantJoin: "enabled", wantBlocking: "none"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			m := newDeleteCheckMetrics(reg, tt.legacyJoin)

			_ = validateOnDelete(context.Background(), folder, tt.searcher, tt.options, tt.cascade, m)

			require.Equal(t, 1.0, testutil.ToFloat64(m.checks.WithLabelValues(tt.wantOutcome, tt.wantJoin, tt.wantBlocking)))
			require.Equal(t, 1, testutil.CollectAndCount(m.checks), "only one series should have been recorded")
		})
	}
}

func TestDeleteCheckMetricsRegistration(t *testing.T) {
	t.Run("nil registerer yields nil metrics that record nothing", func(t *testing.T) {
		m := newDeleteCheckMetrics(nil, true)
		require.Nil(t, m)
		require.NotPanics(t, func() { m.record(deleteCheckAllowed, blockingKindNone) })
	})

	t.Run("registering twice on one registry fails loudly", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		require.NotNil(t, newDeleteCheckMetrics(reg, true))
		require.Panics(t, func() { newDeleteCheckMetrics(reg, true) })
	})
}
