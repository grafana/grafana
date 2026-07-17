package appinstaller

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
	genericrest "k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

func TestIsSubresourcePath(t *testing.T) {
	require.False(t, isSubresourcePath("shorturls"))
	require.True(t, isSubresourcePath("shorturls/status"))
	require.True(t, isSubresourcePath("dashboards/dto"))
}

func TestServedVersionsForResource(t *testing.T) {
	const group = "dashboard.grafana.app"

	tests := []struct {
		name    string
		storage map[string]map[string]genericrest.Storage
		want    map[string][]string
	}{
		{
			name:    "empty map",
			storage: map[string]map[string]genericrest.Storage{},
			want:    map[string][]string{},
		},
		{
			// Each resource is scoped to the versions IT is served under: librarypanels
			// only under v0alpha1, even though the group serves v1/v2beta1 for dashboards.
			// Subresource paths must not add duplicate versions. This is what scopes the
			// guard per resource instead of per group.
			name: "scopes versions per resource, ignoring subresources",
			storage: map[string]map[string]genericrest.Storage{
				"v0alpha1": {"dashboards": nil, "dashboards/dto": nil, "librarypanels": nil, "librarypanels/foo": nil},
				"v1":       {"dashboards": nil},
				"v2beta1":  {"dashboards": nil},
			},
			want: map[string][]string{
				"dashboards":    {"v0alpha1", "v1", "v2beta1"},
				"librarypanels": {"v0alpha1"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiGroupInfo := &genericapiserver.APIGroupInfo{VersionedResourcesStorageMap: tt.storage}

			got := map[string][]string{}
			for resource, gvs := range servedVersionsForResource(apiGroupInfo, group) {
				for _, gv := range gvs {
					require.Equal(t, group, gv.Group)
					got[resource] = append(got[resource], gv.Version)
				}
				sort.Strings(got[resource])
			}
			require.Equal(t, tt.want, got)
		})
	}
}
