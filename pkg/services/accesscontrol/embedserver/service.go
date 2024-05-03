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

type ServiceCfg struct {
	// SingleRead is a flag to enable single read
	// Overrides all other flags
	SingleRead bool

	// DashboardReadResult is a flag to enable dashboard read result from Zanzana
	DashboardReadResult bool
	// EvaluationResult is a flag to enable evaluation result from Zanzana
	EvaluationResult bool
}

type Service struct {
	*zanzanaService.Service
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	log      log.Logger
	Cfg      *ServiceCfg
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*Service, error) {
	section := cfg.SectionWithEnvOverrides("zanzana")
	s := &Service{
		cfg:      cfg,
		features: features,
		log:      log.New("accesscontrol.zanzana"),
		Cfg: &ServiceCfg{
			SingleRead:          section.Key("single_read").MustBool(false),
			DashboardReadResult: section.Key("dashboard_read_result").MustBool(false),
			EvaluationResult:    section.Key("evaluation_result").MustBool(false),
		},
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

	cl, err := srv.GetClient(ctx, "1")
	if err != nil {
		return nil, err
	}

	storeID, err := cl.GetOrCreateStoreID(ctx)
	if err != nil {
		return nil, err
	}

	err = cl.LoadModel(ctx, model)
	if err != nil {
		return nil, err
	}
	s.log.Info("Zanzana service started", "storeID", storeID)

	return s, nil
}
