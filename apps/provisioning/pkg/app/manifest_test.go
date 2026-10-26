package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestManifestIsValid(t *testing.T) {
	m := ManifestData()
	require.NoError(t, m.Validate())
	require.Len(t, m.Versions, len(Versions))
}

func TestRoutesResolveToGoTypes(t *testing.T) {
	assoc := GoTypeAssociator{}
	for _, r := range Routes {
		for _, method := range r.Methods {
			got, ok := assoc.CustomRouteReturnGoType(r.Kind, "v0alpha1", r.Path, method)
			require.True(t, ok, "%s %s/%s", method, r.Kind, r.Path)
			require.Equal(t, r.Response, got)
		}
	}

	_, ok := assoc.CustomRouteReturnGoType(KindRepository, "v0alpha1", "files", http.MethodPatch)
	require.False(t, ok)
}
