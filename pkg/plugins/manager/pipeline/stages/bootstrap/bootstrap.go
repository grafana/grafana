package bootstrap

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
)

type Bootstrapper interface {
	Run(ctx context.Context, src plugins.PluginSource, found []*plugins.FoundBundle) ([]*plugins.Plugin, error)
}

type BootstrapStep func(ctx context.Context, prev []*plugins.Plugin) ([]*plugins.Plugin, error)

type Bootstrap struct {
	// Inputs
	// Services
	signatureCalculator plugins.SignatureCalculator
	assetPath           *assetpath.Service
	// Assets
	src   plugins.PluginSource
	found []*plugins.FoundBundle
	// Misc
	log log.Logger
}

func New(signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *Bootstrap {
	b := &Bootstrap{
		assetPath:           assetPath,
		signatureCalculator: signatureCalculator,
		log:                 log.New("plugins.bootstrap"),
	}
	return b
}

func (b *Bootstrap) Run(ctx context.Context, src plugins.PluginSource, found []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
	// Init
	b.src = src
	b.found = found
	// Run
	res := []*plugins.Plugin{}
	for _, step := range b.steps() {
		ps, err := step(ctx, res)
		if err != nil {
			return nil, err
		}
		res = ps
	}
	return res, nil
}

func (b *Bootstrap) steps() []BootstrapStep {
	return []BootstrapStep{
		b.bootstrapStep,
		b.decorateStep,
	}
}
