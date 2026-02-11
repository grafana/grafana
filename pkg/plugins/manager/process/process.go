package process

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/prometheus/client_golang/prometheus"
)

const defaultKeepPluginAliveTickerDuration = time.Second

const (
	eventStart        = "start"
	eventDecommission = "decommission"
	eventStop         = "stop"
	eventRestart      = "restart"

	eventStatusError = "error"
	eventStatusOk    = "ok"
)

type Service struct {
	keepPluginAliveTickerDuration time.Duration
	statusChangeCounter           *prometheus.CounterVec
}

func ProvideService(registerer prometheus.Registerer) (*Service, error) {
	statusChangeCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Subsystem: "plugin",
		Name:      "status_change_total",
	}, []string{"plugin_id", "event", "status"})
	err := registerer.Register(statusChangeCounter)
	alreadyRegistered := prometheus.AlreadyRegisteredError{}
	if errors.As(err, &alreadyRegistered) {
		if alreadyRegistered.ExistingCollector != alreadyRegistered.NewCollector {
			return nil, err
		}
	}
	return &Service{
		keepPluginAliveTickerDuration: defaultKeepPluginAliveTickerDuration,
		statusChangeCounter:           statusChangeCounter,
	}, nil
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

func (s *Service) Stop(ctx context.Context, p *plugins.Plugin) error {
	p.Logger().Debug("Stopping plugin process")
	if err := p.Decommission(); err != nil {
		s.statusChange(p.ID, eventDecommission, eventStatusError)
		return err
	}
	s.statusChange(p.ID, eventDecommission, eventStatusOk)

	if err := p.Stop(ctx); err != nil {
		s.statusChange(p.ID, eventStop, eventStatusError)
		return err
	}

	s.statusChange(p.ID, eventStop, eventStatusOk)
	return nil
}

func (s *Service) startPluginAndKeepItAlive(ctx context.Context, p *plugins.Plugin) error {
	if err := p.Start(ctx); err != nil {
		s.statusChange(p.ID, eventStart, eventStatusError)
		return err
	}
	s.statusChange(p.ID, eventStart, eventStatusOk)

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
			s.statusChange(p.ID, eventRestart, eventStatusError)
			p.Logger().Error("Failed to restart plugin", "error", err)
			continue
		}
		s.statusChange(p.ID, eventRestart, eventStatusOk)
		p.Logger().Debug("Plugin restarted")
	}
}

func (s *Service) statusChange(pid string, event string, status string) {
	s.statusChangeCounter.WithLabelValues(pid, event, status).Inc()
}
