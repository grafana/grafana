package grafanaapiserver

import (
	"context"

	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
)

type Standalone struct {
	engine modules.Engine
}

var _ modules.Engine = (*Standalone)(nil)

func ProvideStandalone(
	mod modules.Engine,
	// these are included to register modules
	// since the module service registry is not
	// used in standalone mode
	_ *certgenerator.ModuleRegistration,
	_ *ModuleRegistration,
) *Standalone {
	return &Standalone{engine: mod}
}

func (s *Standalone) Run(ctx context.Context) error {
	return s.engine.Run(ctx)
}

func (s *Standalone) Init(ctx context.Context) error {
	return s.engine.Init(ctx)
}

func (s *Standalone) AwaitHealthy(ctx context.Context) error {
	return s.engine.AwaitHealthy(ctx)
}

func (s *Standalone) Shutdown(ctx context.Context, reason string) error {
	return s.engine.Shutdown(ctx, reason)
}
