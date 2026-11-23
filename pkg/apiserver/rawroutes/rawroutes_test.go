package rawroutes

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type provider struct{ routes []Route }

func (p provider) RawRoutes() []Route { return p.routes }

func TestCollect(t *testing.T) {
	gv := schema.GroupVersion{Group: "live.grafana.app", Version: "v1alpha1"}
	ws := Route{API: gv, Namespaced: true, Method: http.MethodGet, Path: "ws"}
	push := Route{API: gv, Namespaced: true, Method: http.MethodPost, Path: "push"}

	items := []any{
		provider{routes: []Route{ws}},
		"not a provider",
		provider{routes: []Route{push}},
	}

	require.Equal(t, []Route{ws, push}, Collect(items))
	require.Empty(t, Collect([]any{"none"}))
}
