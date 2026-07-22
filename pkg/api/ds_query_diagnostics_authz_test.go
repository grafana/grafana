package api

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

// TestDiagnosticsRoutesAreServerAdminOnly asserts the on-demand diagnostics endpoints are gated to
// Grafana (server) admins by the reqGrafanaAdmin middleware at route registration
// (see registerRoutes / api.go). It drives the REAL router + middleware chain via SetupAPITestServer
// rather than calling the handlers directly, so it fails if the gate is ever dropped.
//
// The contract under test: an anonymous caller must FAIL with 401, a signed-in non-admin must FAIL
// with 403, and a server admin must NOT be blocked by authz. Because reqGrafanaAdmin runs before the
// handler, unauthorized callers short-circuit before any handler/flag/dependency logic — so no
// handler dependencies need wiring.
func TestDiagnosticsRoutesAreServerAdminOnly(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg := setting.NewCfg()
		// On-prem gate: the diagnostics routes only register when StackID is empty (never on Cloud).
		cfg.StackID = ""
		hs.Cfg = cfg
	})

	// Every on-demand diagnostics route. The two POSTs trigger generation; the GETs poll/download it.
	routes := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/ds/diagnostics"},
		{http.MethodPost, "/api/ds/dashboard-diagnostics"},
		{http.MethodGet, "/api/ds/dashboard-diagnostics/someuid"},
		{http.MethodGet, "/api/ds/dashboard-diagnostics/someuid/download"},
	}

	// Signed-in users who are NOT server admins. Note the org admin (IsGrafanaAdmin=false): org-level
	// admin must not be enough — the gate requires Grafana/server admin.
	nonAdmins := []struct {
		name string
		usr  *user.SignedInUser
	}{
		{"viewer", &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer, IsGrafanaAdmin: false}},
		{"editor", &user.SignedInUser{UserID: 2, OrgID: 1, OrgRole: org.RoleEditor, IsGrafanaAdmin: false}},
		{"org admin (not server admin)", &user.SignedInUser{UserID: 3, OrgID: 1, OrgRole: org.RoleAdmin, IsGrafanaAdmin: false}},
	}

	for _, rt := range routes {
		t.Run(fmt.Sprintf("%s %s as anonymous is unauthorized", rt.method, rt.path), func(t *testing.T) {
			req := server.NewRequest(rt.method, rt.path, nil)
			req = webtest.RequestWithWebContext(req, &contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{},
				IsSignedIn:   false,
			})

			resp, err := server.Send(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, http.StatusUnauthorized, resp.StatusCode,
				"anonymous caller must be blocked by reqGrafanaAdmin before reaching the handler")
		})

		for _, na := range nonAdmins {
			t.Run(fmt.Sprintf("%s %s as %s is forbidden", rt.method, rt.path, na.name), func(t *testing.T) {
				req := server.NewRequest(rt.method, rt.path, nil)
				req = webtest.RequestWithSignedInUser(req, na.usr)

				resp, err := server.Send(req)
				require.NoError(t, err)
				require.NoError(t, resp.Body.Close())

				require.Equal(t, http.StatusForbidden, resp.StatusCode,
					"non-admin must be blocked by reqGrafanaAdmin before reaching the handler")
			})
		}

		t.Run(fmt.Sprintf("%s %s as server admin is not forbidden", rt.method, rt.path), func(t *testing.T) {
			serverAdmin := &user.SignedInUser{UserID: 99, OrgID: 1, OrgRole: org.RoleViewer, IsGrafanaAdmin: true}

			req := server.NewRequest(rt.method, rt.path, nil)
			req = webtest.RequestWithSignedInUser(req, serverAdmin)

			resp, err := server.Send(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			// Cleared the gate, so the handler runs; its response depends on feature state and wiring.
			require.NotEqual(t, http.StatusForbidden, resp.StatusCode,
				"server admin must clear the authz gate and reach the handler")
		})
	}
}
