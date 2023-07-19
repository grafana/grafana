package initializer

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/envvars"
)

type Initializer struct {
	envVarProvider  envvars.Provider
	backendProvider plugins.BackendFactoryProvider
}

func New(cfg *config.Cfg, backendProvider plugins.BackendFactoryProvider, license plugins.Licensing) Initializer {
	return Initializer{
		envVarProvider:  envvars.NewProvider(cfg, license),
		backendProvider: backendProvider,
	}
}

func (i *Initializer) Initialize(ctx context.Context, p *plugins.Plugin) error {
	if p.Backend {
		backendFactory := i.backendProvider.BackendFactory(ctx, p)
		if backendFactory == nil {
			return errors.New("could not find backend factory for plugin")
		}

		env, err := i.envVarProvider.Get(ctx, p)
		if err != nil {
			return err
		}
		if backendClient, err := backendFactory(p.ID, p.Logger(), env); err != nil {
			return err
		} else {
			p.RegisterClient(backendClient)
		}
	}

	return nil
}
