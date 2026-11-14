package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func runWith(allow bool, method, pattern, action string) int {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, pattern, nil)
	c := &contextmodel.ReqContext{
		Context:      &web.Context{Req: req, Resp: web.NewResponseWriter(method, rec)},
		SignedInUser: &user.SignedInUser{AuthenticatedBy: "personal_token", OrgID: 1, Permissions: map[int64]map[string][]string{1: {action: nil}}},
	}
	PersonalTokenGuard(func() bool { return allow })(pattern).(func(*contextmodel.ReqContext))(c)
	if rec.Code == http.StatusOK && rec.Body.Len() == 0 {
		return 0
	}
	return rec.Code
}

func TestPersonalTokenGuard(t *testing.T) {
	run := func(authBy string, allow bool, method, pattern string) int {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(method, pattern, nil)
		c := &contextmodel.ReqContext{
			Context:      &web.Context{Req: req, Resp: web.NewResponseWriter(method, rec)},
			SignedInUser: &user.SignedInUser{AuthenticatedBy: authBy},
		}
		PersonalTokenGuard(func() bool { return allow })(pattern).(func(*contextmodel.ReqContext))(c)
		if rec.Code == http.StatusOK && rec.Body.Len() == 0 {
			return 0
		}
		return rec.Code
	}
	require.Equal(t, http.StatusForbidden, run("personal_token", false, "POST", "/api/user/password"))
	// Admin mode lifts a route only when the token explicitly holds the mapped action.
	require.Equal(t, http.StatusForbidden, run("personal_token", true, "POST", "/api/user/password"))
	require.Equal(t, 0, runWith(true, "POST", "/api/user/password", "users.password:write"))
	require.Equal(t, http.StatusForbidden, runWith(true, "GET", "/api/users", "settings:read"))
	require.Equal(t, 0, runWith(true, "GET", "/api/admin/settings", "settings:read"))
	require.Equal(t, http.StatusForbidden, runWith(true, "PUT", "/api/admin/settings", "settings:read"))
	require.Equal(t, 0, run("personal_token", false, "POST", "/api/dashboards/db"))
	require.Equal(t, 0, run("password", false, "POST", "/api/user/password"))
}

func TestPersonalTokenKubernetesGuard(t *testing.T) {
	run := func(authBy, path string) int {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("GET", path, nil)
		c := &contextmodel.ReqContext{
			Context:      &web.Context{Req: req, Resp: web.NewResponseWriter("GET", rec)},
			SignedInUser: &user.SignedInUser{AuthenticatedBy: authBy},
		}
		PersonalTokenKubernetesGuard().(func(*contextmodel.ReqContext))(c)
		if rec.Code == http.StatusOK && rec.Body.Len() == 0 {
			return 0
		}
		return rec.Code
	}
	require.Equal(t, http.StatusForbidden, run("personal_token", "/apis/folder.grafana.app/v1beta1/namespaces/default/folders"))
	require.Equal(t, http.StatusForbidden, run("personal_token", "/openapi/v3"))
	require.Equal(t, 0, run("personal_token", "/api/dashboards/home"))
	require.Equal(t, 0, run("password", "/apis/folder.grafana.app/v1beta1/namespaces/default/folders"))
}
