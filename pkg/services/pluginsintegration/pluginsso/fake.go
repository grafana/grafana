package pluginsso

import (
	"context"
)

type FakeSSOSettingsProvider struct {
	GetForProviderFunc func(ctx context.Context, provider string) (*Settings, error)
}

func (m *FakeSSOSettingsProvider) GetForProvider(ctx context.Context, provider string) (*Settings, error) {
	if m.GetForProviderFunc != nil {
		return m.GetForProviderFunc(ctx, provider)
	}
	return nil, nil
}
