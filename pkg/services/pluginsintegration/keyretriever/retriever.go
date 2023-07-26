package keyretriever

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/dynamic"
)

var _ plugins.KeyRetriever = (*Service)(nil)

type Service struct {
	kr plugins.KeyRetriever
}

func ProvideService(dkr *dynamic.KeyRetriever) *Service {
	s := &Service{}
	if !dkr.IsDisabled() {
		s.kr = dkr
	} else {
		s.kr = statickey.New()
	}
	return s
}

func (kr *Service) GetPublicKey(ctx context.Context, keyID string) (string, error) {
	return kr.kr.GetPublicKey(ctx, keyID)
}
