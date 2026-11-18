package api

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type recordingRouter struct{ routes map[[2]string]bool }

func (r *recordingRouter) Handle(method, pattern string, _ []web.Handler) {
	r.routes[[2]string{method, pattern}] = true
}
func (r *recordingRouter) Get(pattern string, _ ...web.Handler) {
	r.routes[[2]string{"GET", pattern}] = true
}

func TestRegisteredSensitiveRoutesRejectPersonalTokens(t *testing.T) {
	hs := &HTTPServer{
		RouteRegister:      routing.NewRouteRegister(),
		License:            &licensing.OSSLicensingService{},
		Features:           featuremgmt.WithFeatures(),
		QuotaService:       quotatest.New(false, nil),
		searchUsersService: &searchusers.OSSService{},
		tracer:             tracing.InitializeTracerForTest(),
		Cfg:                setting.NewCfg(),
	}
	hs.registerRoutes()
	rec := &recordingRouter{routes: map[[2]string]bool{}}
	hs.RouteRegister.Register(rec)
	require.NotEmpty(t, rec.routes)

	// Every registered route in these families must be denied for tokens.
	mustDeny := func(method, pattern string) bool {
		for _, pre := range []string{"/api/user/password", "/api/user/email", "/api/user/auth-tokens", "/api/user/revoke-auth-token", "/logout"} {
			if len(pattern) >= len(pre) && pattern[:len(pre)] == pre {
				return true
			}
		}
		for _, pre := range []string{"/api/admin", "/api/users", "/api/orgs", "/api/org/users", "/api/ldap", "/api/saml", "/api/access-control/roles", "/api/access-control/users"} {
			if strings.HasPrefix(pattern, pre) {
				return true
			}
		}
		if method != "GET" {
			for _, pre := range []string{"/api/serviceaccounts", "/api/admin/", "/api/orgs", "/api/org/users", "/api/auth/keys"} {
				if len(pattern) >= len(pre) && pattern[:len(pre)] == pre {
					return true
				}
			}
		}
		if method != "GET" {
			for _, pre := range []string{"/api/teams", "/api/org"} {
				if strings.HasPrefix(pattern, pre) {
					return true
				}
			}
			if strings.Contains(pattern, "/permissions") || strings.Contains(pattern, "/roles") {
				return true
			}
		}
		return false
	}

	checked := 0
	for k := range rec.routes {
		if mustDeny(k[0], k[1]) {
			checked++
			require.True(t, patscope.IsDeniedRoute(k[0], k[1]), "%s %s must reject personal tokens", k[0], k[1])
		}
	}
	require.Greater(t, checked, 10, "expected to find sensitive routes")
}
