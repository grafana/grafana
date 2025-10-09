package ssosettings

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

type FakeSSOSettingsService struct {
	GetProviderFunc             func(ctx context.Context, provider string) (*models.SSOSettings, error)
	GetForProviderFromCacheFunc func(ctx context.Context, provider string) (*models.SSOSettings, error)
}

func (m FakeSSOSettingsService) List(ctx context.Context) ([]*models.SSOSettings, error) {
	return nil, nil
}

func (m FakeSSOSettingsService) ListWithRedactedSecrets(ctx context.Context) ([]*models.SSOSettings, error) {
	return nil, nil
}

func (m FakeSSOSettingsService) GetForProvider(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if m.GetProviderFunc != nil {
		return m.GetProviderFunc(ctx, provider)
	}
	return nil, nil
}

func (m FakeSSOSettingsService) GetForProviderFromCache(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if m.GetForProviderFromCacheFunc != nil {
		return m.GetForProviderFromCache(ctx, provider)
	}
	return nil, nil
}

func (m FakeSSOSettingsService) GetForProviderWithRedactedSecrets(ctx context.Context, provider string) (*models.SSOSettings, error) {
	return nil, nil
}

func (m FakeSSOSettingsService) Upsert(ctx context.Context, settings *models.SSOSettings, requester identity.Requester) error {
	return nil
}

func (m FakeSSOSettingsService) Delete(ctx context.Context, provider string) error {
	return nil
}

func (m FakeSSOSettingsService) Patch(ctx context.Context, provider string, data map[string]any) error {
	return nil
}

func (m FakeSSOSettingsService) RegisterReloadable(provider string, reloadable Reloadable) {
}

func (m FakeSSOSettingsService) Reload(ctx context.Context, provider string) {}
