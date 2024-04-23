package embedserver

import (
	"context"

	"github.com/openfga/openfga/pkg/logger"

	"github.com/grafana/zanzana/pkg/schema"
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
		log:      log.New("accesscontrol.zanzana"),
	}

	// FIXME: Replace with zap compatible logger
	zapLogger := logger.MustNewLogger("text", "debug", "ISO8601")

	ctx := context.Background()
	srv, err := zanzanaService.NewService(ctx, zapLogger, nil)
	if err != nil {
		return nil, err
	}

	s.Service = srv

	// move to seeder and take into account persistence
	dslBuf, err := schema.BuildModel(nil, schema.LoadResources())
	if err != nil {
		return nil, err
	}

	model, err := schema.TransformToModel(dslBuf.String())
	if err != nil {
		return nil, err
	}

	err = srv.LoadModel(ctx, model, "1")
	if err != nil {
		return nil, err
	}

	storeID, err := srv.GetOrCreateStoreID(ctx, "1")
	if err != nil {
		return nil, err
	}
	s.log.Info("Zanzana service started", "storeID", storeID)

	return s, nil
}
