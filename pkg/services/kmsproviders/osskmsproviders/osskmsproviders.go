package osskmsproviders

import (
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	grafana "github.com/grafana/grafana/pkg/services/secrets/defaultprovider"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	enc      encryption.Internal
	settings setting.Provider
}

func ProvideService(enc encryption.Internal, settings setting.Provider) Service {
	return Service{
		enc:      enc,
		settings: settings,
	}
}

func (s Service) Provide() (map[string]secrets.Provider, error) {
	if !s.settings.IsFeatureToggleEnabled(secrets.EnvelopeEncryptionFeatureToggle) {
		return nil, nil
	}

	return map[string]secrets.Provider{
		kmsproviders.Default: grafana.New(s.settings, s.enc),
	}, nil
}
