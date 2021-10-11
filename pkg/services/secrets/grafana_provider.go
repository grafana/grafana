package secrets

import (
	"context"

	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/setting"
)

type grafanaProvider struct {
	settings   setting.Provider
	encryption encryption.Service
}

func newGrafanaProvider(settings setting.Provider, encryption encryption.Service) grafanaProvider {
	return grafanaProvider{
		settings:   settings,
		encryption: encryption,
	}
}

func (p grafanaProvider) Encrypt(ctx context.Context, blob []byte) ([]byte, error) {
	key := p.settings.KeyValue("security", "secret_key").Value()
	return p.encryption.Encrypt(ctx, blob, key)
}

func (p grafanaProvider) Decrypt(ctx context.Context, blob []byte) ([]byte, error) {
	key := p.settings.KeyValue("security", "secret_key").Value()
	return p.encryption.Decrypt(ctx, blob, key)
}
