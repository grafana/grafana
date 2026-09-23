package nats

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	natsclient "github.com/nats-io/nats.go"
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
	pendingConn   *natsclient.Conn
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
	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	p.discardClosedPending()
	drained := p.closeWithResult()
	if drained {
		p.pendingBytes = 0
		p.oldestPending = 0
		p.metrics.pendingBytes.Set(0)
		p.metrics.oldestPending.Set(0)
		return nil
	}
	pending := p.pendingBytes
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
	// Serialize acceptance and accounting with replacement/closure observation.
	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	p.discardClosedPending()
	nc, err := p.get(ctx)
	if err != nil {
		return err
	}
	// The previous client may have closed during get's replacement dial.
	p.discardClosedPending()
	p.pendingConn = nc
	if !p.canPublish(nc) {
		p.metrics.publishErrors.Inc()
		return fmt.Errorf("publish to %q: nats connection has not connected successfully: %w", subject, natsclient.ErrConnectionReconnecting)
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
		p.pendingBytes += bytes
		if p.oldestPending == 0 {
			p.oldestPending = time.Now().UnixNano()
			p.metrics.oldestPending.Set(float64(time.Now().Unix()))
		}
		p.metrics.pendingBytes.Set(float64(p.pendingBytes))
	}
	p.log.Debug("accepted message for publish", "subject", subject, "bytes", len(data), "connected", nc.IsConnected())
	return nil
}

func (p *PublisherService) flush(ctx context.Context) {
	p.pendingMu.Lock()
	p.discardClosedPending()
	p.mu.Lock()
	nc := p.conn
	p.mu.Unlock()
	p.discardClosedPending()
	if nc == nil || !nc.IsConnected() {
		p.pendingMu.Unlock()
		return
	}
	// Snapshot both owner and watermark: another Publish may replace a closed
	// client or add more buffered bytes while this flush is in flight.
	p.pendingConn = nc
	watermark := p.pendingBytes
	p.pendingMu.Unlock()

	if err := nc.FlushWithContext(ctx); err != nil {
		// A timeout is an observation, not a reason to replay messages: the
		// server may already have accepted them.
		p.log.Warn("nats publisher flush failed", "err", err)
		return
	}
	if p.reconcilePending(nc, watermark) {
		p.metrics.lastSuccessfulFlush.Set(float64(time.Now().Unix()))
	}
}

// reconcilePending clears at most watermark bytes from the pending estimate,
// preserving accounting for messages buffered after the watermark was snapshotted.
func (p *PublisherService) reconcilePending(nc *natsclient.Conn, watermark int64) bool {
	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	if p.pendingConn != nc {
		return false
	}
	p.pendingBytes -= watermark
	if p.pendingBytes < 0 {
		p.pendingBytes = 0
	}
	if p.pendingBytes == 0 {
		p.oldestPending = 0
		p.metrics.oldestPending.Set(0)
	}
	p.metrics.pendingBytes.Set(float64(p.pendingBytes))
	return true
}

// discardClosedPending requires pendingMu. A terminally closed client's buffer
// cannot be flushed by its replacement; record unconfirmed work as loss first.
func (p *PublisherService) discardClosedPending() {
	if p.pendingConn == nil || !p.pendingConn.IsClosed() {
		return
	}
	if p.pendingBytes > 0 {
		p.metrics.connectionLoss.Inc()
		p.log.Warn("nats publisher connection closed with locally accepted messages pending", "bytes", p.pendingBytes)
	}
	p.pendingConn = nil
	p.pendingBytes = 0
	p.oldestPending = 0
	p.metrics.pendingBytes.Set(0)
	p.metrics.oldestPending.Set(0)
}
