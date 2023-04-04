package authnimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn/authntest"
)

func TestService_getUsageStats(t *testing.T) {
	svc := setupTests(t, func(svc *Service) {
		svc.RegisterClient(
			&authntest.FakeClient{ExpectedErr: nil, ExpectedName: "test", ExpectedPriority: 1, ExpectedStats: map[string]interface{}{"stats.test.enabled.count": 1}})
		svc.RegisterClient(
			&authntest.FakeClient{ExpectedErr: errCantAuthenticateReq, ExpectedName: "failing", ExpectedPriority: 1, ExpectedStats: nil})
	})

	svc.cfg.DisableLoginForm = false
	svc.cfg.DisableLogin = false
	svc.cfg.BasicAuthEnabled = true
	svc.cfg.AuthProxyEnabled = true
	svc.cfg.JWTAuthEnabled = true
	svc.cfg.LDAPAuthEnabled = true
	svc.cfg.EditorsCanAdmin = true
	svc.cfg.ViewersCanEdit = true

	got, err := svc.getUsageStats(context.Background())
	require.NoError(t, err)
	want := map[string]interface{}{"stats.auth_enabled.anonymous.count": 0,
		"stats.auth_enabled.auth_proxy.count":       1,
		"stats.auth_enabled.basic_auth.count":       1,
		"stats.auth_enabled.grafana_password.count": 1,
		"stats.auth_enabled.jwt.count":              1,
		"stats.auth_enabled.ldap.count":             1,
		"stats.auth_enabled.login_form.count":       1,
		"stats.authz.editors_can_admin.count":       1,
		"stats.authz.viewers_can_edit.count":        1,
		"stats.test.enabled.count":                  1,
	}

	require.Equal(t, want, got)
}
