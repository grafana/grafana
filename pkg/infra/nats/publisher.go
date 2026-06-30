package nats

import (
	"context"
	"fmt"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const publisherName = "nats-publisher"

// Publisher hides nats.go types so callers can mock it.
type Publisher interface {
	Enabled() bool
	Publish(ctx context.Context, subject string, data []byte) error
}

// PublisherService owns the publisher lifecycle and implements Publisher. It is a dskit service that bridges to the monolith background-service contract via Run.
type PublisherService struct {
	services.NamedService
	*connection
	metrics *publisherMetrics
}

func newPublisher(logger log.Logger, m *publisherMetrics, config *Config, credentials func() string) *PublisherService {
	conn := newConnection(rolePublisher, logger, m.connectionMetrics, config, credentials)
	p := &PublisherService{connection: conn, metrics: m}
	p.NamedService = services.NewBasicService(nil, p.running, p.stopping).WithName(publisherName)
	return p
}

// ProvidePublisher builds the publisher from the shared connection config (which
// carries the bus config and resolves the mode) plus its per-role credentials,
// registering its own metrics.
func ProvidePublisher(cfg *setting.Cfg, config *Config, reg prometheus.Registerer) *PublisherService {
	return newPublisher(log.New("infra.nats.publisher"), newPublisherMetrics(reg), config, cfg.NATS.Auth.PublisherCredentials)
}

func (p *PublisherService) IsDisabled() bool {
	return !p.Enabled()
}

// Run bridges the dskit service into the monolith background-service contract.
func (p *PublisherService) Run(ctx context.Context) error {
	if err := p.StartAsync(ctx); err != nil {
		return err
	}
	return p.AwaitTerminated(ctx)
}

func (p *PublisherService) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (p *PublisherService) stopping(_ error) error {
	p.close()
	return nil
}

func (p *PublisherService) Health(_ context.Context) error {
	return p.healthy()
}

func (p *PublisherService) Publish(ctx context.Context, subject string, data []byte) error {
	nc, err := p.get(ctx)
	if err != nil {
		return err
	}
	if err := nc.Publish(subject, data); err != nil {
		p.metrics.publishErrors.Inc()
		return fmt.Errorf("publish to %q: %w", subject, err)
	}
	p.metrics.messagesPublished.Inc()
	return nil
}
