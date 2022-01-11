package osskmsproviders

import (
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	grafana "github.com/grafana/grafana/pkg/services/kmsproviders/defaultprovider"
	"github.com/grafana/grafana/pkg/services/secrets"
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

func (s Service) Provide() (map[secrets.ProviderID]secrets.Provider, error) {
	if !s.settings.IsFeatureToggleEnabled(secrets.EnvelopeEncryptionFeatureToggle) {
		return nil, nil
	}

	return map[secrets.ProviderID]secrets.Provider{
		kmsproviders.Default: grafana.New(s.settings, s.enc),
	}, nil
}
