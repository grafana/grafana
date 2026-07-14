package strategies

import (
	"context"
	"slices"

	"github.com/open-feature/go-sdk/openfeature"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

// SettingsLister is the subset of the MT-Settings client the MT-Settings
// strategies need to load provider settings.
type SettingsLister interface {
	List(ctx context.Context, selector metav1.LabelSelector) ([]*settingsvc.Setting, error)
}

// The MT-Settings strategies resolve provider settings from the MT-Settings
// service. Each provider family has its own adapter, registered directly in
// front of the family's legacy strategy: while the grafana.ssoSettingsToMTSettings
// feature toggle is enabled the adapter wins the match and fails loudly
// instead of silently falling back to the legacy mechanism.
type mtSettingsStrategy struct {
	settings SettingsLister
	matches  func(provider string) bool
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

func NewMTSettingsOAuthStrategy(settings SettingsLister) *MTSettingsOAuthStrategy {
	return &MTSettingsOAuthStrategy{mtSettingsStrategy{
		settings: settings,
		matches: func(provider string) bool {
			return slices.Contains(ssosettings.AllOAuthProviders, provider)
		},
	}}
}

type MTSettingsLDAPStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsLDAPStrategy)(nil)

func NewMTSettingsLDAPStrategy(settings SettingsLister) *MTSettingsLDAPStrategy {
	return &MTSettingsLDAPStrategy{mtSettingsStrategy{
		settings: settings,
		matches: func(provider string) bool {
			return provider == social.LDAPProviderName
		},
	}}
}

type MTSettingsSAMLStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsSAMLStrategy)(nil)

func NewMTSettingsSAMLStrategy(settings SettingsLister) *MTSettingsSAMLStrategy {
	return &MTSettingsSAMLStrategy{mtSettingsStrategy{
		settings: settings,
		matches: func(provider string) bool {
			return provider == social.SAMLProviderName
		},
	}}
}
