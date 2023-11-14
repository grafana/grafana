package ssosettings

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

var (
	// ConfigurableOAuthProviders is a list of OAuth providers that can be configured from the API
	// TODO: make it configurable
	ConfigurableOAuthProviders = []string{"github", "gitlab", "google", "generic_oauth", "azuread", "okta"}

	AllOAuthProviders = []string{"github", "gitlab", "google", "generic_oauth", "grafana_com", "azuread", "okta"}
)

// Service is a SSO settings service
type Service interface {
	// List returns all SSO settings from DB and config files
	List(ctx context.Context, requester identity.Requester) ([]*models.SSOSetting, error)
	// GetForProvider returns the SSO settings for a given provider (DB or config file)
	GetForProvider(ctx context.Context, provider string) (*models.SSOSetting, error)
	// Upsert creates or updates the SSO settings for a given provider
	Upsert(ctx context.Context, provider string, data map[string]interface{}) error
	// Delete deletes the SSO settings for a given provider (soft delete)
	Delete(ctx context.Context, provider string) error
	// Patch updates the specified SSO settings (key-value pairs) for a given provider
	Patch(ctx context.Context, provider string, data map[string]interface{}) error
	// RegisterReloadable registers a reloadable provider
	RegisterReloadable(ctx context.Context, provider string, reloadable Reloadable)
	// Reload implements ssosettings.Reloadable interface
	Reload(ctx context.Context, provider string)
}

// Reloadable is an interface that can be implemented by a provider to allow it to be reloaded
type Reloadable interface {
	Reload(ctx context.Context) error
}

// FallbackStrategy is an interface that can be implemented to allow a provider to load settings from a different source
// than the database. This is useful for providers that are not configured in the database, but instead are configured
// using the config file and/or environment variables. Used mostly for backwards compatibility.
type FallbackStrategy interface {
	IsMatch(provider string) bool
	ParseConfigFromSystem(ctx context.Context) (map[string]interface{}, error)
}

// Store is a SSO settings store
//
//go:generate mockery --name Store --structname MockStore --outpkg ssosettingstests --filename store_mock.go --output ./ssosettingstests/
type Store interface {
	Get(ctx context.Context, provider string) (*models.SSOSetting, error)
	List(ctx context.Context) ([]*models.SSOSetting, error)
	Upsert(ctx context.Context, provider string, data map[string]interface{}) error
	Patch(ctx context.Context, provider string, data map[string]interface{}) error
	Delete(ctx context.Context, provider string) error
}
