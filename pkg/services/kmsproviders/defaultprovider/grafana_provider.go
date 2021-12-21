package defaultprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

type grafanaProvider struct {
	settings   setting.Provider
	encryption encryption.Internal
}

func New(settings setting.Provider, encryption encryption.Internal) secrets.Provider {
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
