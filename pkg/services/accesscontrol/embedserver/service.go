package embedserver

import (
	"context"

	"github.com/openfga/openfga/pkg/logger"

	zanzanaService "github.com/grafana/zanzana/pkg/service"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	*zanzanaService.Service
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	log      log.Logger
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*Service, error) {
	s := &Service{
		cfg:      cfg,
		features: features,
		log:      log.New("accesscontrol.service"),
	}

	// FIXME: Replace with zap compatible logger
	zapLogger := logger.MustNewLogger("text", "debug", "ISO8601")

	ctx := context.Background()
	srv, err := zanzanaService.NewService(ctx, zapLogger, nil)
	if err != nil {
		return nil, err
	}

	s.Service = srv

	return s, nil
}
