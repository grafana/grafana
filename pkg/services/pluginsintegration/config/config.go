package config

import (
	"fmt"
	"strings"

	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideConfig(settingProvider setting.Provider, grafanaCfg *setting.Cfg) (*pCfg.Cfg, error) {
	plugins := settingProvider.Section("plugins")
	allowedUnsigned := grafanaCfg.PluginsAllowUnsigned
	if len(plugins.KeyValue("allow_loading_unsigned_plugins").Value()) > 0 {
		allowedUnsigned = strings.Split(plugins.KeyValue("allow_loading_unsigned_plugins").Value(), ",")
	}

	aws := settingProvider.Section("aws")
	allowedAuth := grafanaCfg.AWSAllowedAuthProviders
	if len(aws.KeyValue("allowed_auth_providers").Value()) > 0 {
		allowedUnsigned = strings.Split(settingProvider.KeyValue("plugins", "allow_loading_unsigned_plugins").Value(), ",")
	}

	tracingCfg, err := newTracingCfg(grafanaCfg)
	if err != nil {
		return nil, fmt.Errorf("new opentelemetry cfg: %w", err)
	}
	return pCfg.NewCfg(
		settingProvider.KeyValue("", "app_mode").MustBool(grafanaCfg.Env == setting.Dev),
		grafanaCfg.PluginsPath,
		extractPluginSettings(settingProvider),
		allowedUnsigned,
		allowedAuth,
		aws.KeyValue("assume_role_enabled").MustBool(grafanaCfg.AWSAssumeRoleEnabled),
		grafanaCfg.Azure,
		grafanaCfg.SecureSocksDSProxy,
		grafanaCfg.BuildVersion,
		grafanaCfg.PluginLogBackendRequests,
		grafanaCfg.PluginsCDNURLTemplate,
		tracingCfg,
	), nil
}

func extractPluginSettings(settingProvider setting.Provider) setting.PluginSettings {
	ps := setting.PluginSettings{}
	for sectionName, sectionCopy := range settingProvider.Current() {
		if !strings.HasPrefix(sectionName, "plugin.") {
			continue
		}
		// Calling Current() returns a redacted version of section. We need to replace the map values with the unredacted values.
		section := settingProvider.Section(sectionName)
		for k := range sectionCopy {
			sectionCopy[k] = section.KeyValue(k).MustString("")
		}
		pluginID := strings.Replace(sectionName, "plugin.", "", 1)
		ps[pluginID] = sectionCopy
	}

	return ps
}
