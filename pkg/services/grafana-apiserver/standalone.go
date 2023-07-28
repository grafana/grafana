package grafanaapiserver

import (
	"context"

	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
)

type standalone struct {
	engine modules.Engine
}

var _ modules.Engine = (*standalone)(nil)

func ProvideStandalone(certReg *certgenerator.ModuleRegistration, apiReg *ModuleRegistration, mod modules.Engine) *standalone {
	return &standalone{engine: mod}
}

func (s *standalone) Run(ctx context.Context) error {
	return s.engine.Run(ctx)
}

func (s *standalone) Init(ctx context.Context) error {
	return s.engine.Init(ctx)
}

func (s *standalone) AwaitHealthy(ctx context.Context) error {
	return s.engine.AwaitHealthy(ctx)
}

func (s *standalone) Shutdown(ctx context.Context, reason string) error {
	return s.engine.Shutdown(ctx, reason)
}
