package bootstrap

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
)

type Bootstrapper interface {
	Bootstrap(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error)
}

type ConstructFunc func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error)

type DecorateFunc func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error)

type Bootstrap struct {
	constructStep ConstructFunc
	decorateSteps []DecorateFunc
	log           log.Logger
}

type Opts struct {
	ConstructFunc ConstructFunc
	DecorateFuncs []DecorateFunc
}

func New(cfg *config.Cfg, opts Opts) *Bootstrap {
	if opts.ConstructFunc == nil {
		opts.ConstructFunc = DefaultConstructFunc(signature.DefaultCalculator(), assetpath.DefaultService(cfg))
	}

	if len(opts.DecorateFuncs) == 0 {
		opts.DecorateFuncs = DefaultDecorateFuncs
	}

	return &Bootstrap{
		constructStep: opts.ConstructFunc,
		decorateSteps: opts.DecorateFuncs,
		log:           log.New("plugins.discovery"),
	}
}

func NewBootstrapStage(signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *Bootstrap {
	return &Bootstrap{
		constructStep: DefaultConstructFunc(signatureCalculator, assetPath),
		decorateSteps: DefaultDecorateFuncs,
		log:           log.New("plugins.bootstrap"),
	}
}

func (b *Bootstrap) Bootstrap(ctx context.Context, src plugins.PluginSource, found []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
	ps, err := b.constructStep(ctx, src, found)
	if err != nil {
		return nil, err
	}

	for _, p := range ps {
		for _, decorator := range b.decorateSteps {
			p, err = decorator(ctx, p)
			if err != nil {
				return nil, err
			}
		}
	}

	return ps, nil
}
