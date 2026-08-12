package authnimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

func (s *Service) getUsageStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	// Add stats about auth configuration
	authTypes := map[string]bool{}
	authTypes["basic_auth"] = s.cfg.BasicAuthEnabled
	authTypes["ldap"] = s.cfg.LDAPAuthEnabled
	authTypes["auth_proxy"] = s.cfg.AuthProxy.Enabled
	authTypes["anonymous"] = s.cfg.Anonymous.Enabled
	authTypes["jwt"] = s.cfg.JWTAuth.Enabled
	authTypes["grafana_password"] = !s.cfg.DisableLogin
	authTypes["login_form"] = !s.cfg.DisableLoginForm

	for authType, enabled := range authTypes {
		enabledValue := 0
		if enabled {
			enabledValue = 1
		}
		m["stats.auth_enabled."+authType+".count"] = enabledValue
	}

	// Add stats about privilege elevators.
	// FIXME: Move this to accesscontrol OSS.
	// FIXME: Access Control OSS usage stats is currently disabled if Enterprise is enabled.
	m["stats.authz.viewers_can_edit.count"] = 0
	//nolint:staticcheck // ViewersCanEdit is deprecated but still used for backward compatibility
	if s.cfg.ViewersCanEdit {
		m["stats.authz.viewers_can_edit.count"] = 1
	}

	for _, client := range s.clients {
		if usac, ok := client.(authn.UsageStatClient); ok {
			clientStats, err := usac.UsageStatFn(ctx)
			if err != nil {
				s.log.Warn("Failed to get usage stats from client", "client", client.Name(), "error", err)
			}

			for k, v := range clientStats {
				m[k] = v
			}
		}
	}

	return m, nil
}
