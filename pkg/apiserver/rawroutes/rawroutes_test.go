package rawroutes

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

type provider struct{ routes []Route }

func (p provider) RawRoutes() []Route { return p.routes }

func TestCollect(t *testing.T) {
	ws := Route{Group: "live.grafana.app", Version: "v1alpha1", Method: http.MethodGet, Path: "ws"}
	push := Route{Group: "live.grafana.app", Version: "v1alpha1", Method: http.MethodPost, Path: "push"}

	items := []any{
		provider{routes: []Route{ws}},
		"not a provider",
		provider{routes: []Route{push}},
	}

	require.Equal(t, []Route{ws, push}, Collect(items))
	require.Empty(t, Collect([]any{"none"}))
}
