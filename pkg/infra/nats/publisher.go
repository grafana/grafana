package nats

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// Publisher hides nats.go types so consumers can mock it.
type Publisher interface {
	Enabled() bool
	Publish(ctx context.Context, subject string, data []byte) error
}

type publisher struct {
	*connection
}

func newPublisher(cfg setting.NATSSettings, logger log.Logger, m *metrics, urls func() []string) *publisher {
	conn := newConnection(rolePublisher, cfg, logger, m, urls, cfg.Auth.PublisherCredentials)
	return &publisher{connection: conn}
}

func (p *publisher) Publish(ctx context.Context, subject string, data []byte) error {
	nc, err := p.get(ctx)
	if err != nil {
		return err
	}
	role := string(p.role)
	if err := nc.Publish(subject, data); err != nil {
		p.metrics.publishErrors.WithLabelValues(role).Inc()
		return fmt.Errorf("publish to %q: %w", subject, err)
	}
	p.metrics.messagesPub.WithLabelValues(role).Inc()
	return nil
}
