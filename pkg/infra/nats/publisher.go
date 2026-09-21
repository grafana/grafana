package nats

import (
	"context"
	"fmt"
	"sync"
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
	metrics       *publisherMetrics
	pendingMu     sync.Mutex
	pendingBytes  int64
	oldestPending int64
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

	// Establish the connection so config/auth failures surface at startup. A
	// broker outage at boot is not fatal: RetryOnFailedConnect(true) returns a
	// reconnecting client that keeps retrying in the background while Publish
	// buffers into the bounded reconnect queue, so storage can continue. Failing
	// here would take down Grafana (or the NATS module) for a transient outage.
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
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			flushCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			p.flush(flushCtx)
			cancel()
		}
	}
}

func (p *PublisherService) stopping(_ error) error {
	drained := p.closeWithResult()
	if drained {
		p.pendingMu.Lock()
		p.pendingBytes = 0
		p.oldestPending = 0
		p.metrics.pendingBytes.Set(0)
		p.metrics.oldestPending.Set(0)
		p.pendingMu.Unlock()
		return nil
	}
	p.pendingMu.Lock()
	pending := p.pendingBytes
	p.pendingMu.Unlock()
	if pending > 0 {
		p.metrics.forcedDrainLoss.Inc()
		p.log.Warn("nats publisher closed with locally accepted messages pending", "bytes", pending)
	}
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
		if isConnStateErr(err) {
			return fmt.Errorf("publish to %q: nats connection not established (status=%s, last_err=%v): %w", subject, nc.Status(), nc.LastError(), err)
		}
		return fmt.Errorf("publish to %q: %w", subject, err)
	}
	p.metrics.messagesAccepted.Inc()
	// nats.go owns the bounded reconnect queue. Track only messages accepted
	// while disconnected; a successful FlushWithContext clears that estimate.
	if !nc.IsConnected() {
		bytes := int64(len(subject) + len(data))
		p.pendingMu.Lock()
		p.pendingBytes += bytes
		if p.oldestPending == 0 {
			p.oldestPending = time.Now().UnixNano()
			p.metrics.oldestPending.Set(float64(time.Now().Unix()))
		}
		p.metrics.pendingBytes.Set(float64(p.pendingBytes))
		p.pendingMu.Unlock()
	}
	p.log.Debug("accepted message for publish", "subject", subject, "bytes", len(data), "connected", nc.IsConnected())
	return nil
}

func (p *PublisherService) flush(ctx context.Context) {
	p.mu.Lock()
	nc := p.conn
	p.mu.Unlock()
	if nc == nil || !nc.IsConnected() {
		return
	}
	if err := nc.FlushWithContext(ctx); err != nil {
		// A timeout is an observation, not a reason to replay messages: the
		// server may already have accepted them.
		p.log.Warn("nats publisher flush failed", "err", err)
		return
	}
	p.pendingMu.Lock()
	if p.pendingBytes > 0 {
		p.pendingBytes = 0
		p.oldestPending = 0
		p.metrics.pendingBytes.Set(0)
		p.metrics.oldestPending.Set(0)
	}
	p.pendingMu.Unlock()
	p.metrics.lastSuccessfulFlush.Set(float64(time.Now().Unix()))
}
