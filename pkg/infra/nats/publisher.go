package nats

import (
	"context"
	"fmt"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const publisherName = "nats-publisher"

// Publisher hides nats.go types so callers can mock it.
type Publisher interface {
	Enabled() bool
	Publish(ctx context.Context, subject string, data []byte) error
}

// PublisherService is an independent NATS client: it depends only on the shared
// endpoints and never on the embedded Server, so in Cloud it is built straight
// from configuration. It is a dskit service so its connection drains on
// shutdown, and bridges to the monolith background-service contract via Run.
type PublisherService struct {
	services.NamedService
	*connection
}

func newPublisher(cfg setting.NATSSettings, logger log.Logger, m *metrics, ep *endpoints) *PublisherService {
	conn := newConnection(rolePublisher, cfg, logger, m, ep, cfg.Auth.PublisherCredentials)
	p := &PublisherService{connection: conn}
	p.NamedService = services.NewBasicService(nil, p.running, p.stopping).WithName(publisherName)
	return p
}

// ProvidePublisher builds the publisher from configuration and the shared
// endpoints. It is independent of the embedded Server: Cloud wires this without
// a Server, On-Prem wires both.
func ProvidePublisher(cfg *setting.Cfg, ep *endpoints, m *metrics) *PublisherService {
	return newPublisher(cfg.NATS, log.New("infra.nats.publisher"), m, ep)
}

func (p *PublisherService) IsDisabled() bool {
	return !p.cfg.Enabled
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
	role := string(p.role)
	if err := nc.Publish(subject, data); err != nil {
		p.metrics.publishErrors.WithLabelValues(role).Inc()
		return fmt.Errorf("publish to %q: %w", subject, err)
	}
	p.metrics.messagesPub.WithLabelValues(role).Inc()
	return nil
}
