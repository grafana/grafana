package process

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
)

var (
	keepPluginAliveTickerDuration = time.Second * 1
)

type Service struct{}

func ProvideService() *Service {
	return &Service{}
}

func (*Service) Start(ctx context.Context, p *plugins.Plugin) error {
	if !p.IsManaged() || !p.Backend || p.SignatureError != nil {
		return nil
	}

	if err := startPluginAndKeepItAlive(ctx, p); err != nil {
		return err
	}

	p.Logger().Debug("Successfully started backend plugin process")
	return nil
}

func (*Service) Stop(ctx context.Context, p *plugins.Plugin) error {
	p.Logger().Debug("Stopping plugin process")
	if err := p.Decommission(); err != nil {
		return err
	}

	if err := p.Stop(ctx); err != nil {
		return err
	}

	return nil
}

func startPluginAndKeepItAlive(ctx context.Context, p *plugins.Plugin) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	if p.IsCorePlugin() {
		return nil
	}

	go func(p *plugins.Plugin) {
		if err := keepPluginAlive(p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(p)

	return nil
}

// keepPluginAlive will restart the plugin if the process is killed or exits
func keepPluginAlive(p *plugins.Plugin) error {
	ticker := time.NewTicker(keepPluginAliveTickerDuration)

	for {
		<-ticker.C
		if p.IsDecommissioned() {
			p.Logger().Debug("Plugin decommissioned")
			return nil
		}

		if !p.Exited() {
			continue
		}

		p.Logger().Debug("Restarting plugin")
		if err := p.Start(context.Background()); err != nil {
			p.Logger().Error("Failed to restart plugin", "error", err)
			continue
		}
		p.Logger().Debug("Plugin restarted")
	}
}
