package pluginauth

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/setting"
)

func subjectPolicies(cfg *setting.Cfg) (map[string]*v3.LocalSubjectPolicy, error) {
	var policies map[string]*v3.LocalSubjectPolicy
	if cfg == nil {
		return policies, nil
	}
	for pluginID, settings := range cfg.PluginSettings {
		value := settings["allow_subject_signing"]
		if value == "" {
			continue
		}
		enabled, err := strconv.ParseBool(value)
		if err != nil {
			return nil, fmt.Errorf("plugin %s: invalid allow_subject_signing: %w", pluginID, err)
		}
		if !enabled {
			continue
		}
		policy := &v3.LocalSubjectPolicy{}
		if value := settings["subject_signing_max_token_lifetime"]; value != "" {
			maximum, err := time.ParseDuration(value)
			if err != nil || maximum < v3.DefaultLocalSubjectTokenLifetime || maximum%time.Second != 0 {
				return nil, fmt.Errorf("plugin %s: subject_signing_max_token_lifetime must be a duration of at least %s in whole seconds", pluginID, v3.DefaultLocalSubjectTokenLifetime)
			}
			policy.MaxTokenLifetime = maximum
		}
		for _, permission := range strings.Fields(settings["subject_signing_permissions"]) {
			action, verb, ok := strings.Cut(permission, ":")
			if !ok || action == "" || verb == "" || strings.ContainsAny(permission, "*,") {
				return nil, fmt.Errorf("plugin %s: subject_signing_permissions requires space-separated concrete actions", pluginID)
			}
			policy.DelegatedPermissions = append(policy.DelegatedPermissions, permission)
		}
		if len(policy.DelegatedPermissions) == 0 {
			return nil, fmt.Errorf("plugin %s: subject signing requires delegated permissions", pluginID)
		}
		if policies == nil {
			policies = make(map[string]*v3.LocalSubjectPolicy)
		}
		policies[pluginID] = policy
	}
	return policies, nil
}
