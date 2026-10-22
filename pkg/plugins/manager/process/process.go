package process

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
)

const defaultKeepPluginAliveTickerDuration = time.Second

// maxKeepPluginAliveBackoff bounds the wait between restarts of a plugin whose
// start keeps failing.
const maxKeepPluginAliveBackoff = time.Minute

type Service struct {
	keepPluginAliveTickerDuration time.Duration
}

func ProvideService() *Service {
	return &Service{
		keepPluginAliveTickerDuration: defaultKeepPluginAliveTickerDuration,
	}
}

func (s *Service) Start(ctx context.Context, p *plugins.Plugin) error {
	if !p.IsManaged() || !p.Backend || p.Error != nil {
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

	// A plugin whose start keeps failing is retried with exponential backoff,
	// so it isn't started again on every tick.
	failures := 0
	var nextAttempt time.Time
	for {
		<-ticker.C
		if p.IsDecommissioned() {
			p.Logger().Debug("Plugin decommissioned")
			return nil
		}

		if !p.Exited() {
			continue
		}
		if time.Now().Before(nextAttempt) {
			continue
		}

		p.Logger().Debug("Restarting plugin")
		if err := p.Start(context.Background()); err != nil {
			failures++
			delay := min(s.keepPluginAliveTickerDuration<<min(failures, 6), maxKeepPluginAliveBackoff)
			nextAttempt = time.Now().Add(delay)
			p.Logger().Error("Failed to restart plugin", "error", err, "retryIn", delay)
			continue
		}
		failures = 0
		nextAttempt = time.Time{}
		p.Logger().Debug("Plugin restarted")
	}
}
