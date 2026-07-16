package strategies

import (
	"context"
	"slices"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

// The MT-Settings strategies resolve provider settings from the MT-Settings
// service. Each provider family has its own adapter, registered directly in
// front of the family's legacy strategy: while the grafana.ssoSettingsToMTSettings
// feature toggle is enabled the adapter wins the match and fails loudly
// instead of silently falling back to the legacy mechanism.
type mtSettingsStrategy struct {
	matches func(provider string) bool
}

func (s *mtSettingsStrategy) IsMatch(ctx context.Context, provider string) bool {
	enabled := openfeature.NewDefaultClient().Boolean(ctx,
		featuremgmt.FlagGrafanaSsoSettingsToMTSettings, false, openfeature.TransactionContext(ctx))
	return enabled && s.matches(provider)
}

func (s *mtSettingsStrategy) GetProviderConfig(_ context.Context, _ string) (map[string]any, error) {
	return nil, ssosettings.ErrMTSettingsNotImplemented
}

type MTSettingsOAuthStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsOAuthStrategy)(nil)

func NewMTSettingsOAuthStrategy() *MTSettingsOAuthStrategy {
	return &MTSettingsOAuthStrategy{mtSettingsStrategy{
		matches: func(provider string) bool {
			return slices.Contains(ssosettings.AllOAuthProviders, provider)
		},
	}}
}

type MTSettingsLDAPStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsLDAPStrategy)(nil)

func NewMTSettingsLDAPStrategy() *MTSettingsLDAPStrategy {
	return &MTSettingsLDAPStrategy{mtSettingsStrategy{
		matches: func(provider string) bool {
			return provider == social.LDAPProviderName
		},
	}}
}

type MTSettingsSAMLStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsSAMLStrategy)(nil)

func NewMTSettingsSAMLStrategy() *MTSettingsSAMLStrategy {
	return &MTSettingsSAMLStrategy{mtSettingsStrategy{
		matches: func(provider string) bool {
			return provider == social.SAMLProviderName
		},
	}}
}
