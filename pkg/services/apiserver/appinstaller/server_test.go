package appinstaller

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericrest "k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

func TestIsSubresourcePath(t *testing.T) {
	require.False(t, isSubresourcePath("shorturls"))
	require.True(t, isSubresourcePath("shorturls/status"))
	require.True(t, isSubresourcePath("dashboards/dto"))
}

func TestServedVersionsByResource(t *testing.T) {
	const group = "dashboard.grafana.app"

	apiGroupInfo := &genericapiserver.APIGroupInfo{
		VersionedResourcesStorageMap: map[string]map[string]genericrest.Storage{
			"v0alpha1": {
				"dashboards":        nil,
				"dashboards/dto":    nil,
				"librarypanels":     nil,
				"librarypanels/foo": nil,
			},
			"v1": {
				"dashboards": nil,
			},
			"v2beta1": {
				"dashboards": nil,
			},
		},
	}

	served := servedVersionsForResource(apiGroupInfo, group)

	// dashboards is served under all three versions; subresource paths must not add
	// duplicate versions.
	require.ElementsMatch(t, []schema.GroupVersion{
		{Group: group, Version: "v0alpha1"},
		{Group: group, Version: "v1"},
		{Group: group, Version: "v2beta1"},
	}, served["dashboards"])

	// librarypanels is a distinct resource served only under v0alpha1, even though its
	// group serves v1 and v2beta1 for dashboards. This is what scopes the guard per
	// resource instead of per group.
	require.Equal(t, []schema.GroupVersion{{Group: group, Version: "v0alpha1"}}, served["librarypanels"])
}

func TestServedVersionsByResource_Empty(t *testing.T) {
	apiGroupInfo := &genericapiserver.APIGroupInfo{
		VersionedResourcesStorageMap: map[string]map[string]genericrest.Storage{},
	}
	require.Empty(t, servedVersionsForResource(apiGroupInfo, "example.grafana.app"))
}

// versions is a small helper to make the per-resource assertion order-independent.
func versions(gvs []schema.GroupVersion) []string {
	out := make([]string, 0, len(gvs))
	for _, gv := range gvs {
		out = append(out, gv.Version)
	}
	sort.Strings(out)
	return out
}

func TestServedVersionsByResource_Ordering(t *testing.T) {
	const group = "example.grafana.app"
	apiGroupInfo := &genericapiserver.APIGroupInfo{
		VersionedResourcesStorageMap: map[string]map[string]genericrest.Storage{
			"v1beta1": {"widgets": nil},
			"v1":      {"widgets": nil},
		},
	}
	require.Equal(t, []string{"v1", "v1beta1"}, versions(servedVersionsForResource(apiGroupInfo, group)["widgets"]))
}
