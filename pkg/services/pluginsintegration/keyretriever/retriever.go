package keyretriever

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/dynamic"
)

var _ plugins.KeyRetriever = (*Service)(nil)

type Service struct {
	static  *statickey.KeyRetriever
	dynamic *dynamic.KeyRetriever
}

func ProvideService(cfg *config.Cfg, dkr *dynamic.KeyRetriever) *Service {
	kr := &Service{}
	if cfg.Features.IsEnabled(featuremgmt.FlagPluginsAPIManifestKey) {
		kr.dynamic = dkr
	} else {
		kr.static = statickey.New()
	}
	return kr
}

func (kr *Service) GetPublicKey(ctx context.Context, keyID string) (string, error) {
	if kr.dynamic != nil {
		return kr.dynamic.GetPublicKey(ctx, keyID)
	}
	return kr.static.GetPublicKey(ctx, keyID)
}
