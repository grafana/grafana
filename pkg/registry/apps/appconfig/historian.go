// Package appconfig builds the configuration of the apps Grafana hosts from
// Grafana's settings. The apps are separate modules and can't read
// setting.Cfg, so each host (the monolith, the core apps server) calls these
// functions instead of parsing settings itself.
package appconfig

import (
	"errors"

	authtypes "github.com/grafana/authlib/types"

	historianAppConfig "github.com/grafana/alerting/apps/historian/pkg/app/config"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiconfig"
	"github.com/grafana/grafana/pkg/setting"
)

// Deps are the objects apps need that settings can't provide. A function
// documents which of them it requires.
type Deps struct {
	// AccessClient authorizes access checks, such as the historian's
	// alert.rules:read check on each folder.
	AccessClient authtypes.AccessClient
}

// Historian returns the historian app's config from
// [unified_alerting.notification_history]. The state history query handler is
// not part of it, because it needs the running alerting service.
//
// Notification history is left disabled when it is disabled in the settings.
// A nil cfg returns an empty config.
func Historian(cfg *setting.Cfg, deps Deps) (historianAppConfig.RuntimeConfig, error) {
	runtimeCfg := historianAppConfig.RuntimeConfig{}
	if cfg == nil {
		return runtimeCfg, nil
	}

	nhCfg := cfg.UnifiedAlerting.NotificationHistory
	if !nhCfg.Enabled {
		return runtimeCfg, nil
	}

	// RBAC is always on, and the app fails every query closed without a client.
	// Failing here surfaces the missing client at startup instead.
	if deps.AccessClient == nil {
		return historianAppConfig.RuntimeConfig{}, errors.New("notification history is enabled, but no access client is available to authorize it")
	}

	lokiConfig, err := lokiconfig.NewLokiConfig(nhCfg.LokiSettings)
	if err != nil {
		return historianAppConfig.RuntimeConfig{}, err
	}

	runtimeCfg.Notification = historianAppConfig.NotificationConfig{
		Enabled: nhCfg.Enabled,
		Loki: historianAppConfig.LokiConfig{
			LokiConfig: lokiConfig,
			InjectUser: nhCfg.LokiInjectUser,
		},
		// Restrict notification history to the folders whose alert rules the
		// caller can read. RBAC resolves accessible folders via the folder API
		// and the multi-tenant authz service, so it works in the standalone
		// (multi-tenant) historian deployment.
		RBACEnabled:  true,
		AccessClient: deps.AccessClient,
	}
	return runtimeCfg, nil
}
