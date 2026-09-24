package nats

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
)

const publisherName = "nats-publisher"

// Publisher hides nats.go types so callers can mock it.
type Publisher interface {
	Enabler
	Publish(ctx context.Context, subject string, data []byte) error
}

// PublisherService owns the publisher lifecycle and implements Publisher. It is a dskit service that bridges to the monolith background-service contract via Run.
type PublisherService struct {
	services.NamedService
	*connection
	metrics *publisherMetrics
}

func newPublisher(logger log.Logger, m *publisherMetrics, config *Config) *PublisherService {
	conn := newConnection(rolePublisher, logger, m.connectionMetrics, config, config.PublisherCredentials)
	p := &PublisherService{connection: conn, metrics: m}
	p.NamedService = services.NewBasicService(p.starting, p.running, p.stopping).WithName(publisherName)
	return p
}

// ProvidePublisher builds the publisher from the shared connection config, which
// carries the bus config, resolves the mode, and exposes the per-role
// credentials. It registers its own metrics.
func ProvidePublisher(config *Config, reg prometheus.Registerer) *PublisherService {
	m := newPublisherMetrics()
	if config.Enabled() {
		reg.MustRegister(m.collectors()...)
	}
	return newPublisher(log.New("infra.nats.publisher"), m, config)
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

func (p *PublisherService) starting(ctx context.Context) error {
	if !p.Enabled() {
		return nil
	}
	// Embedded server and publisher services start concurrently. Wait until the
	// server has published its in-process URL before making the initial dial.
	if p.config.server != nil && !p.config.server.IsDisabled() {
		ticker := time.NewTicker(10 * time.Millisecond)
		defer ticker.Stop()
		for p.config.server.clientURL() == "" {
			select {
			case <-ctx.Done():
				return nil
			case <-ticker.C:
			}
		}
	}

	// Keep retrying initial broker/authentication failures without failing Grafana
	// startup. Publish rejects messages until this connection first succeeds.
	nc, err := p.get(ctx)
	if err != nil {
		if ctx.Err() != nil {
			return nil
		}
		return err
	}
	if !nc.IsConnected() {
		p.log.Warn("nats publisher not yet connected at startup; retrying in the background",
			"status", nc.Status(), "last_err", nc.LastError())
	}
	return nil
}

func (p *PublisherService) running(ctx context.Context) error {
	// Publish is fire-and-forget: nats.go's flusher pushes each message to the
	// server, PingInterval detects a dead link, and the reconnect buffer replays
	// automatically after a reconnect. Nothing for the loop to do but stay alive
	// until shutdown.
	<-ctx.Done()
	return nil
}

func (p *PublisherService) stopping(_ error) error {
	// close() marks the connection closed before draining, so concurrent Publish
	// callers see ErrClosed immediately rather than blocking on the drain.
	p.close()
	return nil
}

func (p *PublisherService) Health(_ context.Context) error {
	return p.healthy()
}

func (p *PublisherService) Publish(ctx context.Context, subject string, data []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	nc, err := p.publishConn()
	if err != nil {
		if errors.Is(err, ErrDisabled) || errors.Is(err, ErrClosed) {
			return err
		}
		p.metrics.publishErrors.Inc()
		return fmt.Errorf("publish to %q: %w", subject, err)
	}
	// nats.go is safe for concurrent Publish and owns the bounded reconnect
	// buffer; a full buffer surfaces here as ErrReconnectBufExceeded.
	if err := nc.Publish(subject, data); err != nil {
		p.metrics.publishErrors.Inc()
		if isConnStateErr(err) {
			return fmt.Errorf("publish to %q: nats connection not established (status=%s, last_err=%v): %w", subject, nc.Status(), nc.LastError(), err)
		}
		return fmt.Errorf("publish to %q: %w", subject, err)
	}
	p.metrics.messagesAccepted.Inc()
	p.log.Debug("accepted message for publish", "subject", subject, "bytes", len(data), "connected", nc.IsConnected())
	return nil
}
