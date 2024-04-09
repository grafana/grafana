package process

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
)

const defaultKeepPluginAliveTickerDuration = time.Second

type Service struct {
	keepPluginAliveTickerDuration time.Duration
}

func ProvideService() *Service {
	return &Service{
		keepPluginAliveTickerDuration: defaultKeepPluginAliveTickerDuration,
	}
}

func (s *Service) Start(ctx context.Context, p *plugins.Plugin) error {
	if !p.IsManaged() || !p.Backend || p.SignatureError != nil || p.Status.Errored {
		return nil
	}

	if err := s.startPluginAndKeepItAlive(ctx, p); err != nil {
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

func (s *Service) startPluginAndKeepItAlive(ctx context.Context, p *plugins.Plugin) error {
	if err := p.Start(ctx); err != nil {
		return err
	}

	if p.IsCorePlugin() {
		return nil
	}

	go func(p *plugins.Plugin) {
		if err := s.keepPluginAlive(p); err != nil {
			p.Logger().Error("Attempt to restart killed plugin process failed", "error", err)
		}
	}(p)

	return nil
}

// keepPluginAlive will restart the plugin if the process is killed or exits
func (s *Service) keepPluginAlive(p *plugins.Plugin) error {
	ticker := time.NewTicker(s.keepPluginAliveTickerDuration)

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
