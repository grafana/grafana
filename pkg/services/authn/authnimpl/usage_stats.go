package authnimpl

import "context"

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

	return m, nil
}
