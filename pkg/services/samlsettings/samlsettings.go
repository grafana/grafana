package samlsettings

import "context"

var (
	ConfigurableSAMLProvicers = []string{"saml"}
	AllSAMLProviders          = []string{"saml"}
)

// FallbackStrategy is an interface that can be implemented to allow a provider to load settings from a different source
// than the database. This is useful for providers that are not configured in the database, but instead are configured
// using the config file and/or environment variables. Used mostly for backwards compatibility.
type FallbackStrategy interface {
	IsMatch(provider string) bool
	GetProviderConfig(_ context.Context, provider string) (map[string]any, error)
}
