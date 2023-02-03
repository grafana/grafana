package authnimpl

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

func (s *Service) getUsageStats(ctx context.Context) (map[string]interface{}, error) {
	m := map[string]interface{}{}

	// Add stats about auth configuration
	authTypes := map[string]bool{}
	authTypes["anonymous"] = s.cfg.AnonymousEnabled
	authTypes["basic_auth"] = s.cfg.BasicAuthEnabled
	authTypes["ldap"] = s.cfg.LDAPEnabled
	authTypes["auth_proxy"] = s.cfg.AuthProxyEnabled

	for authType, enabled := range authTypes {
		enabledValue := 0
		if enabled {
			enabledValue = 1
		}
		m["stats.auth_enabled."+authType+".count"] = enabledValue
	}

	// Add stats about anonymous auth
	if strings.EqualFold(s.cfg.AnonymousOrgRole, "Viewer") {
		m["stats.auth.anonymous.customized_role.count"] = 1
	}

	// Add stats about privilege elevators.
	// FIXME: Move this to accesscontrol OSS
	if setting.ViewersCanEdit {
		m["stats.authz.viewers_can_edit.count"] = 1
	}

	if s.cfg.EditorsCanAdmin {
		m["stats.authz.editors_can_admin.count"] = 1
	}

	return m, nil
}
