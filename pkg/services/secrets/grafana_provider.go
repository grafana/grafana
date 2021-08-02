package secrets

import (
	"github.com/grafana/grafana/pkg/services/secrets/encryption"
	"github.com/grafana/grafana/pkg/setting"
)

type grafanaProvider struct {
	settings   setting.Provider
	encryption encryption.EncryptionService
}

func newGrafanaProvider(settings setting.Provider, encryption encryption.EncryptionService) grafanaProvider {
	return grafanaProvider{
		settings:   settings,
		encryption: encryption,
	}
}

func (p grafanaProvider) Encrypt(blob []byte) ([]byte, error) {
	key := p.settings.KeyValue("security", "secret_key").Value()
	return p.encryption.Encrypt(blob, []byte(key))
}

func (p grafanaProvider) Decrypt(blob []byte) ([]byte, error) {
	key := p.settings.KeyValue("security", "secret_key").Value()
	return p.encryption.Decrypt(blob, []byte(key))
}
