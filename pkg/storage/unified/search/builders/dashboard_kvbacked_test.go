package builders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The dashboards builder
// takes part in the kind-neutral KV refresh only when its stats really come
// from the KV store.

func TestDashboardDocumentBuilder_KVFieldSnapshot_OnlyWhenKVBacked(t *testing.T) {
	t.Parallel()
	stats := map[string]map[string]int64{"d1": {"views_total": 7, "errors_total": 1}}

	snap, ok := (&DashboardDocumentBuilder{KVBacked: false, Stats: stats}).KVFieldSnapshot()
	assert.False(t, ok, "a builder whose stats aren't KV-backed must not report a KV field snapshot")
	assert.Nil(t, snap)

	snap, ok = (&DashboardDocumentBuilder{KVBacked: true, Stats: stats}).KVFieldSnapshot()
	require.True(t, ok)
	assert.Equal(t, resource.KVFieldSnapshot{"d1": {"views_total": int64(7), "errors_total": int64(1)}}, snap)

	snap, ok = (&DashboardDocumentBuilder{KVBacked: true}).KVFieldSnapshot()
	require.True(t, ok, "a KV-backed builder with no stats yet still takes part")
	assert.Empty(t, snap)
}

type plainStats struct{}

func (plainStats) GetStats(context.Context, string) (map[string]map[string]int64, error) {
	return map[string]map[string]int64{"d1": {"views_total": 1}}, nil
}
func (plainStats) GetDashboardStats(context.Context, string, string) (map[string]int64, error) {
	return nil, nil
}

type refresherStats struct {
	plainStats
	fromKV bool
}

func (r refresherStats) RefreshesFromKV() bool { return r.fromKV }

func TestAll_SetsDashboardKVBackedFromRefreshesFromKV(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		sprinkles DashboardStats
		want      bool
	}{
		{name: "RefreshesFromKV true", sprinkles: refresherStats{fromKV: true}, want: true},
		{name: "RefreshesFromKV false", sprinkles: refresherStats{fromKV: false}, want: false},
		{name: "no RefreshesFromKV method (legacy sprinkles)", sprinkles: plainStats{}, want: false},
		{name: "no sprinkles", sprinkles: nil, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			infos, err := All(iamTestRegistry(t), nil, tt.sprinkles)
			require.NoError(t, err)

			var found bool
			for _, info := range infos {
				if info.GroupResource.Group != "dashboard.grafana.app" || info.GroupResource.Resource != "dashboards" {
					continue
				}
				found = true
				require.NotNil(t, info.Namespaced, "dashboards use a namespaced builder")
				b, err := info.Namespaced(context.Background(), "default", nil)
				require.NoError(t, err)
				db, ok := b.(*DashboardDocumentBuilder)
				require.True(t, ok, "dashboards builder is %T", b)
				assert.Equal(t, tt.want, db.KVBacked)
				_, snapOK := db.KVFieldSnapshot()
				assert.Equal(t, tt.want, snapOK)
			}
			require.True(t, found, "All returned no dashboards builder")
		})
	}
}
