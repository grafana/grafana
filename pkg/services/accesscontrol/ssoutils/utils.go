package ssoutils

import (
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

func EvalAuthenticationSettings(settingsProvider setting.SettingsProvider) ac.Evaluator {
	return ac.EvalAny(
		ac.EvalAll(
			ac.EvalPermission(ac.ActionSettingsWrite, ac.ScopeSettingsSAML),
			ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsSAML),
		),
		ac.EvalPermission(ac.ActionLDAPStatusRead))
}

func OauthSettingsEvaluator(settingsProvider setting.SettingsProvider) ac.Evaluator {
	cfg := settingsProvider.Get()
	result := make([]ac.Evaluator, 0, len(cfg.SSOSettingsConfigurableProviders))
	for provider := range cfg.SSOSettingsConfigurableProviders {
		result = append(result, ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsOAuth(provider)))
		result = append(result, ac.EvalPermission(ac.ActionSettingsWrite, ac.ScopeSettingsOAuth(provider)))
	}
	return ac.EvalAny(result...)
}
