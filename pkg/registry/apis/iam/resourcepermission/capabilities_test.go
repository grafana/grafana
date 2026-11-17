package resourcepermission

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestCapabilitiesFollowRegistrationAndLicense(t *testing.T) {
	t.Parallel()
	m := NewMappersRegistry()
	gr := schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"}
	enabled := false
	query := func(want string) {
		t.Helper()
		route := m.CapabilityRoutes().Namespace[0]
		require.Equal(t, "resourcepermissions/capabilities", route.Path)
		req := httptest.NewRequest(http.MethodGet, "/?apiGroup=secret.grafana.app&resource=securevalues", nil)
		req = mux.SetURLVars(req, map[string]string{"namespace": "default"})
		req = req.WithContext(types.WithAuthInfo(req.Context(), &identity.StaticRequester{UserID: 1, UserUID: "u1", Type: types.TypeUser}))
		res := httptest.NewRecorder()
		route.Handler(res, req)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		require.JSONEq(t, want, res.Body.String())
		require.Equal(t, "no-store", res.Header().Get("Cache-Control"))
	}
	query(`{"enabled":false}`)
	m.RegisterMapper(gr, NewMapper("secret.securevalues", []string{"View", "Edit", "Admin"}), func() bool { return enabled })
	query(`{"enabled":false}`)
	enabled = true
	query(`{"enabled":true}`)
	enabled = false
	query(`{"enabled":false}`)
}

func TestCapabilitiesRejectInvalidRequests(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		name, query, namespace string
		authenticated          bool
		status                 int
	}{
		{"anonymous", "?apiGroup=secret.grafana.app&resource=securevalues", "default", false, 401},
		{"missing namespace", "?apiGroup=secret.grafana.app&resource=securevalues", "", true, 400},
		{"missing group", "?resource=securevalues", "default", true, 400},
		{"missing resource", "?apiGroup=secret.grafana.app", "default", true, 400},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := mux.SetURLVars(httptest.NewRequest(http.MethodGet, "/"+tt.query, nil), map[string]string{"namespace": tt.namespace})
			if tt.authenticated {
				req = req.WithContext(types.WithAuthInfo(req.Context(), &identity.StaticRequester{UserID: 1, UserUID: "u1", Type: types.TypeUser}))
			}
			res := httptest.NewRecorder()
			NewMappersRegistry().CapabilityRoutes().Namespace[0].Handler(res, req)
			require.Equal(t, tt.status, res.Code, res.Body.String())
		})
	}
}
