package pluginsso

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ssosettings"
)

// SettingsProvider is used to get the SSO settings for a given provider.
type SettingsProvider interface {
	GetForProvider(ctx context.Context, provider string) (*Settings, error)
}

type Settings struct {
	Values map[string]any
}

// DefaultSettingsProvider is the default implementation of the SettingsProvider interface.
// It uses the SSO settings service to get the settings for a given provider.
type DefaultSettingsProvider struct {
	ssoSettings ssosettings.Service
}

func ProvideDefaultSettingsProvider(ssoSettings ssosettings.Service) *DefaultSettingsProvider {
	return &DefaultSettingsProvider{
		ssoSettings: ssoSettings,
	}
}

// GetForProvider returns the SSO settings for a given provider.
// The settings are fetched from the cache if available, otherwise they are fetched from the database.
func (p *DefaultSettingsProvider) GetForProvider(ctx context.Context, provider string) (*Settings, error) {
	settings, err := p.ssoSettings.GetForProviderFromCache(ctx, provider)
	if err != nil {
		return nil, err
	}

	return &Settings{
		Values: settings.Settings,
	}, nil
}
