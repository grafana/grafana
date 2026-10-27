package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/manifestdata"
)

func TestManifestWithRoutesIsValid(t *testing.T) {
	routes := NewRouteTable(Route{Kind: KindRepository, Path: "extra", Methods: []string{http.MethodGet}})
	m := WithRoutes(*manifestdata.LocalManifest().ManifestData, routes)
	require.NoError(t, m.Validate())
	require.Len(t, m.Versions, len(Versions))
	for _, v := range m.Versions {
		for _, k := range v.Kinds {
			require.Len(t, k.Routes, len(routes.For(k.Kind)), "%s %s", v.Name, k.Kind)
		}
	}
}

func TestRoutesResolveToGoTypes(t *testing.T) {
	routes := NewRouteTable()
	assoc := GoTypeAssociator{Routes: routes}
	for _, r := range routes {
		for _, method := range r.Methods {
			got, ok := assoc.CustomRouteReturnGoType(r.Kind, "v0alpha1", r.Path, method)
			require.True(t, ok, "%s %s/%s", method, r.Kind, r.Path)
			require.Equal(t, r.Response, got)
		}
	}

	_, ok := assoc.CustomRouteReturnGoType(KindRepository, "v0alpha1", "files", http.MethodPatch)
	require.False(t, ok)
}
