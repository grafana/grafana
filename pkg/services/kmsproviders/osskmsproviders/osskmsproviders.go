package osskmsproviders

import (
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	grafana "github.com/grafana/grafana/pkg/services/kmsproviders/defaultprovider"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	enc      encryption.Internal
	settings setting.Provider
	features featuremgmt.FeatureToggles
}

func ProvideService(enc encryption.Internal, settings setting.Provider, features featuremgmt.FeatureToggles) Service {
	return Service{
		enc:      enc,
		settings: settings,
		features: features,
	}
}

func (s Service) Provide() (map[secrets.ProviderID]secrets.Provider, error) {
	return map[secrets.ProviderID]secrets.Provider{
		kmsproviders.Default: grafana.New(s.settings, s.enc),
	}, nil
}
