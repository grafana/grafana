package strategies

import (
	"context"
	"slices"

	"github.com/open-feature/go-sdk/openfeature"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/ssosettings/strategies")

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
	// serveReads gates matching on the storage mode having reached the read-flip
	// (mode 3), fixed at construction. Below it the legacy strategy serves.
	serveReads bool
}

func (s *mtSettingsStrategy) IsMatch(ctx context.Context, provider string) bool {
	if !s.serveReads {
		return false
	}
	enabled := openfeature.NewDefaultClient().Boolean(ctx,
		featuremgmt.FlagGrafanaSsoSettingsToMTSettings, false, openfeature.TransactionContext(ctx))
	return enabled && s.matches(provider)
}

// ServesMTSettings marks the adapter as MT-Settings-backed, selecting MT-wins
// read precedence in the service once it serves a read.
func (s *mtSettingsStrategy) ServesMTSettings() bool { return true }

// GetProviderConfig loads the provider's settings from the MT-Settings
// service: the rows of the auth.<provider> section, keyed like the ini keys
// the legacy strategies return. Source-layer precedence and decrypt-on-read
// are handled by the MT-Settings server. Two deliberate divergences from the
// legacy strategies: values are raw strings (consumers decode with weak
// typing) rather than typed, and an absent section yields an empty map
// rather than a fully-defaulted key set — the MT-Settings source layering is
// expected to materialize defaults server-side.
func (s *mtSettingsStrategy) GetProviderConfig(ctx context.Context, provider string) (map[string]any, error) {
	ctx, span := tracer.Start(ctx, "mtSettingsStrategy.GetProviderConfig",
		trace.WithAttributes(attribute.String("provider", provider)))
	defer span.End()

	if s.settings == nil {
		return nil, tracing.Error(span, ssosettings.ErrMTSettingsClientNotConfigured)
	}

	selector := metav1.LabelSelector{MatchLabels: map[string]string{
		"section": "auth." + provider,
	}}
	settings, err := s.settings.List(ctx, selector)
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	result := make(map[string]any, len(settings))
	for _, st := range settings {
		result[st.Key] = st.Value
	}
	span.SetAttributes(attribute.Int("settings_count", len(result)))
	return result, nil
}

type MTSettingsOAuthStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsOAuthStrategy)(nil)

func NewMTSettingsOAuthStrategy(settings SettingsLister, serveReads bool) *MTSettingsOAuthStrategy {
	return &MTSettingsOAuthStrategy{mtSettingsStrategy{
		settings:   settings,
		serveReads: serveReads,
		matches: func(provider string) bool {
			return slices.Contains(ssosettings.AllOAuthProviders, provider)
		},
	}}
}

type MTSettingsLDAPStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsLDAPStrategy)(nil)

// NewMTSettingsLDAPStrategy never matches for now: LDAP's nested servers
// configuration has no decided MT-Settings representation yet, so LDAP stays
// on the legacy strategy even while the toggle is enabled. Matching with a
// failing read would poison every provider — Service.List aborts on the
// first fallback error and doReload stops reloading all providers.
func NewMTSettingsLDAPStrategy(settings SettingsLister, serveReads bool) *MTSettingsLDAPStrategy {
	// TODO: serveReads is inert until LDAP matching is implemented; wire it into
	// matches once the servers-config representation is decided.
	return &MTSettingsLDAPStrategy{mtSettingsStrategy{
		settings:   settings,
		serveReads: serveReads,
		matches: func(_ string) bool {
			return false
		},
	}}
}

// GetProviderConfig stays not-implemented for LDAP (unreachable while the
// strategy never matches): its servers configuration is nested (servers[],
// group mappings) and how it maps onto MT-Settings' flat section/key/value
// model is not decided yet. The injected client is unused until then.
func (s *MTSettingsLDAPStrategy) GetProviderConfig(_ context.Context, _ string) (map[string]any, error) {
	return nil, ssosettings.ErrMTSettingsNotImplemented
}

type MTSettingsSAMLStrategy struct {
	mtSettingsStrategy
}

var _ ssosettings.FallbackStrategy = (*MTSettingsSAMLStrategy)(nil)

func NewMTSettingsSAMLStrategy(settings SettingsLister, serveReads bool) *MTSettingsSAMLStrategy {
	return &MTSettingsSAMLStrategy{mtSettingsStrategy{
		settings:   settings,
		serveReads: serveReads,
		matches: func(provider string) bool {
			return provider == social.SAMLProviderName
		},
	}}
}
