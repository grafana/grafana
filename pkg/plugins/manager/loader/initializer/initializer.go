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

		// this will ensure that the env variables are calculated every time a plugin is started
		envFunc := func() []string {
			// envvar.Get actually never returns any error, safe to skip
			vars, err := i.envVarProvider.Get(ctx, p)
			// logging just in case
			if err != nil {
				p.Logger().Error("error building env variables", "err", err)
			}
			return vars
		}

		if backendClient, err := backendFactory(p.ID, p.Logger(), envFunc); err != nil {
			return err
		} else {
			p.RegisterClient(backendClient)
		}
	}

	return nil
}
