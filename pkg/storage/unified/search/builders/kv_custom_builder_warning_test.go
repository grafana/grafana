package builders

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// A kind that declares source.kv fields but also has its own custom builder
// is reported by KVSourcedKindsWithCustomBuilders, so startup can log one
// warning per such kind.
func TestKVSourcedKindsWithCustomBuilders(t *testing.T) {
	t.Parallel()

	dashboards := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	snapshots := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "snapshots"}
	playlists := schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	apples := schema.GroupResource{Group: "a.example.grafana.app", Resource: "apples"}
	users := schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}

	tests := []struct {
		name   string
		kinds  []schema.GroupResource
		custom map[schema.GroupResource]bool
		want   []schema.GroupResource
	}{
		{
			name:   "a kv-sourced kind with a custom builder is reported",
			kinds:  []schema.GroupResource{playlists, dashboards},
			custom: map[schema.GroupResource]bool{dashboards: true, users: true},
			want:   []schema.GroupResource{dashboards},
		},
		{
			name:   "several offenders come back sorted by group, then resource",
			kinds:  []schema.GroupResource{snapshots, playlists, apples, dashboards},
			custom: map[schema.GroupResource]bool{snapshots: true, dashboards: true, apples: true},
			want:   []schema.GroupResource{apples, dashboards, snapshots},
		},
		{
			name:   "a custom builder for a kind that declares no kv source is not reported",
			kinds:  []schema.GroupResource{playlists},
			custom: map[schema.GroupResource]bool{users: true, dashboards: true},
			want:   nil,
		},
		{
			name:   "a custom map entry set to false is not a custom builder",
			kinds:  []schema.GroupResource{dashboards},
			custom: map[schema.GroupResource]bool{dashboards: false},
			want:   nil,
		},
		{
			name:   "no kinds, no warnings",
			kinds:  nil,
			custom: map[schema.GroupResource]bool{dashboards: true},
			want:   nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := KVSourcedKindsWithCustomBuilders(tt.kinds, tt.custom)
			if len(tt.want) == 0 {
				assert.Empty(t, got)
				return
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

// The input slice must not be reordered in place by the sort.
func TestKVSourcedKindsWithCustomBuilders_DoesNotMutateInput(t *testing.T) {
	t.Parallel()
	b := schema.GroupResource{Group: "b.example", Resource: "x"}
	a := schema.GroupResource{Group: "a.example", Resource: "x"}
	kinds := []schema.GroupResource{b, a}
	got := KVSourcedKindsWithCustomBuilders(kinds, map[schema.GroupResource]bool{a: true, b: true})
	assert.Equal(t, []schema.GroupResource{a, b}, got)
	assert.Equal(t, []schema.GroupResource{b, a}, kinds)
}
