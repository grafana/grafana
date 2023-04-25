package keyretriever

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/dynamic"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/static"
)

var _ plugins.KeyRetriever = (*Service)(nil)

type Service struct {
	static  *static.KeyRetriever
	dynamic *dynamic.KeyRetriever
}

func ProvideService(cfg *config.Cfg, kv plugins.KeyStore) *Service {
	kr := &Service{}
	if cfg.Features.IsEnabled(featuremgmt.FlagPluginsAPIManifestKey) {
		kr.dynamic = dynamic.New(cfg, kv)
	} else {
		kr.static = static.New()
	}
	return kr
}

// IsDisabled disables dynamic retrieval of public keys from the API server.
func (kr *Service) IsDisabled() bool {
	return kr.dynamic == nil
}

func (kr *Service) Run(ctx context.Context) error {
	return kr.dynamic.Run(ctx)
}

func (kr *Service) GetPublicKey(ctx context.Context, keyID string) (string, error) {
	if kr.dynamic != nil {
		return kr.dynamic.GetPublicKey(ctx, keyID)
	}
	return kr.static.GetPublicKey(ctx, keyID)
}
