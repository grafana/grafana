package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestPersonalTokenScopedDelegationDenied(t *testing.T) {
	signedIn := func(by string, scopes ...string) *user.SignedInUser {
		return &user.SignedInUser{OrgID: 1, AuthenticatedBy: by,
			Permissions: map[int64]map[string][]string{1: {datasources.ActionQuery: scopes}}}
	}
	tests := []struct {
		name string
		u    *user.SignedInUser
		deny bool
	}{
		{"token scoped to datasource A", signedIn(login.PersonalTokenAuthModule, "datasources:uid:A"), true},
		{"token with a mix of wildcard and uid", signedIn(login.PersonalTokenAuthModule, "datasources:*", "datasources:uid:A"), true},
		{"token with wildcard scope", signedIn(login.PersonalTokenAuthModule, "datasources:*"), false},
		{"token with global wildcard", signedIn(login.PersonalTokenAuthModule, "*"), false},
		{"token without the action", signedIn(login.PersonalTokenAuthModule), false},
		{"regular user scoped to A", signedIn("", "datasources:uid:A"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.deny, personalTokenScopedDelegationDenied(tt.u, datasources.ActionQuery))
		})
	}
}

func TestPersonalTokenRequiresDashboardsRead(t *testing.T) {
	run := func(by string, perms map[string][]string) int {
		hs := &HTTPServer{AccessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures())}
		rec := httptest.NewRecorder()
		c := &contextmodel.ReqContext{
			Context:      &web.Context{Req: httptest.NewRequest("GET", "/api/playlists", nil), Resp: web.NewResponseWriter("GET", rec)},
			SignedInUser: &user.SignedInUser{OrgID: 1, AuthenticatedBy: by, Permissions: map[int64]map[string][]string{1: perms}},
		}
		hs.personalTokenRequiresDashboardsRead()(c)
		return rec.Code
	}
	require.Equal(t, http.StatusForbidden, run(login.PersonalTokenAuthModule, map[string][]string{datasources.ActionRead: {"*"}}))
	require.Equal(t, http.StatusOK, run(login.PersonalTokenAuthModule, map[string][]string{dashboards.ActionDashboardsRead: {"*"}}))
	require.Equal(t, http.StatusOK, run("", map[string][]string{datasources.ActionRead: {"*"}}), "regular users are unaffected")
}
