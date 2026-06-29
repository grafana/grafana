package nats

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var ErrDisabled = errors.New("nats is disabled")

// Bus is the lean seam between the NATS platform and its consumers. It hides
// the nats.go types so consumers can mock it and the transport can evolve
// without touching callers. Publish is fire-and-forget: a dropped message is
// recovered by the consumer's DB catch-up, never a correctness bug.
type Bus interface {
	Enabled() bool
	Publish(ctx context.Context, subject string, data []byte) error
	Subscribe(ctx context.Context, subject string, opts ...SubOption) (Subscription, error)
}

// Subscription is an active NATS subscription. Close drains in-flight messages
// and is safe to call more than once.
type Subscription interface {
	C() <-chan Message
	Close() error
}

type Message struct {
	Subject string
	Data    []byte
}

type SubOption func(*subConfig)

type subConfig struct {
	queueGroup string
	bufferSize int
}

// WithQueueGroup delivers each message to only one subscriber in the group.
func WithQueueGroup(name string) SubOption {
	return func(c *subConfig) { c.queueGroup = name }
}

func WithBufferSize(n int) SubOption {
	return func(c *subConfig) {
		if n > 0 {
			c.bufferSize = n
		}
	}
}

const defaultSubBufferSize = 1024

// connRole identifies a logical connection; publisher and subscriber connect
// separately so they can present distinct least-privilege credentials.
type connRole string

const (
	rolePublisher  connRole = "publisher"
	roleSubscriber connRole = "subscriber"
)

// bus lazily establishes and reuses a publisher and a subscriber connection.
type bus struct {
	cfg     setting.NATSSettings
	log     log.Logger
	metrics *metrics
	// urls is resolved at connect time; the embedded server URL is only known
	// once the server has started.
	urls func() []string

	publisherMu sync.Mutex
	publisher   *natsclient.Conn

	subscriberMu sync.Mutex
	subscriber   *natsclient.Conn

	// extraOptions injects nats.InProcessServer so the local hop to an embedded
	// server bypasses TCP/TLS/auth.
	optsMu       sync.Mutex
	extraOptions []natsclient.Option
}

// setExtraOptions must be called before consumers first use the bus.
func (b *bus) setExtraOptions(opts ...natsclient.Option) {
	b.optsMu.Lock()
	defer b.optsMu.Unlock()
	b.extraOptions = opts
}

func (b *bus) getExtraOptions() []natsclient.Option {
	b.optsMu.Lock()
	defer b.optsMu.Unlock()
	return b.extraOptions
}

func newBus(cfg setting.NATSSettings, logger log.Logger, m *metrics, urls func() []string) *bus {
	return &bus{
		cfg:     cfg,
		log:     logger,
		metrics: m,
		urls:    urls,
	}
}

func (b *bus) Enabled() bool { return b.cfg.Enabled }

func (b *bus) Publish(ctx context.Context, subject string, data []byte) error {
	nc, err := b.publisherConn(ctx)
	if err != nil {
		return err
	}
	if err := nc.Publish(subject, data); err != nil {
		b.metrics.publishErrors.Inc()
		return fmt.Errorf("publish to %q: %w", subject, err)
	}
	b.metrics.messagesPub.Inc()
	return nil
}

func (b *bus) Subscribe(ctx context.Context, subject string, opts ...SubOption) (Subscription, error) {
	cfg := subConfig{bufferSize: defaultSubBufferSize}
	for _, opt := range opts {
		opt(&cfg)
	}

	nc, err := b.subscriberConn(ctx)
	if err != nil {
		return nil, err
	}

	msgs := make(chan *natsclient.Msg, cfg.bufferSize)
	var natsSub *natsclient.Subscription
	if cfg.queueGroup != "" {
		natsSub, err = nc.ChanQueueSubscribe(subject, cfg.queueGroup, msgs)
	} else {
		natsSub, err = nc.ChanSubscribe(subject, msgs)
	}
	if err != nil {
		return nil, fmt.Errorf("subscribe to %q: %w", subject, err)
	}

	return newSubscription(ctx, natsSub, msgs, b.metrics, b.log), nil
}

func (b *bus) publisherConn(ctx context.Context) (*natsclient.Conn, error) {
	if !b.Enabled() {
		return nil, ErrDisabled
	}
	b.publisherMu.Lock()
	defer b.publisherMu.Unlock()
	if b.publisher != nil && !b.publisher.IsClosed() {
		return b.publisher, nil
	}
	nc, err := b.connect(ctx, rolePublisher)
	if err != nil {
		return nil, err
	}
	b.publisher = nc
	return nc, nil
}

func (b *bus) subscriberConn(ctx context.Context) (*natsclient.Conn, error) {
	if !b.Enabled() {
		return nil, ErrDisabled
	}
	b.subscriberMu.Lock()
	defer b.subscriberMu.Unlock()
	if b.subscriber != nil && !b.subscriber.IsClosed() {
		return b.subscriber, nil
	}
	nc, err := b.connect(ctx, roleSubscriber)
	if err != nil {
		return nil, err
	}
	b.subscriber = nc
	return nc, nil
}

func (b *bus) connect(ctx context.Context, role connRole) (*natsclient.Conn, error) {
	urls := b.urls()
	if len(urls) == 0 {
		return nil, fmt.Errorf("no nats client urls configured")
	}

	options, err := b.connectOptions(role)
	if err != nil {
		return nil, err
	}
	options = append(options, b.getExtraOptions()...)

	// nats.Connect blocks on the initial dial; honour ctx cancellation.
	type result struct {
		conn *natsclient.Conn
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		nc, err := natsclient.Connect(strings.Join(urls, ","), options...)
		ch <- result{conn: nc, err: err}
	}()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-ch:
		if res.err != nil {
			b.metrics.connectionErrors.WithLabelValues(string(role)).Inc()
			return nil, fmt.Errorf("connect nats %s: %w", role, res.err)
		}
		b.metrics.connectionStatus.WithLabelValues(string(role)).Set(1)
		return res.conn, nil
	}
}

func (b *bus) connectOptions(role connRole) ([]natsclient.Option, error) {
	roleStr := string(role)
	options := []natsclient.Option{
		natsclient.Name("grafana-nats-" + roleStr),
		natsclient.Timeout(5 * time.Second),
		natsclient.RetryOnFailedConnect(true),
		natsclient.MaxReconnects(-1),
		natsclient.ReconnectWait(2 * time.Second),
		natsclient.ReconnectJitter(100*time.Millisecond, time.Second),
		natsclient.PingInterval(20 * time.Second),
		natsclient.MaxPingsOutstanding(3),
		natsclient.DisconnectErrHandler(func(_ *natsclient.Conn, err error) {
			b.metrics.connectionStatus.WithLabelValues(roleStr).Set(0)
			b.metrics.disconnects.WithLabelValues(roleStr).Inc()
			if err != nil {
				b.log.Warn("nats disconnected", "role", roleStr, "err", err)
			}
		}),
		natsclient.ReconnectHandler(func(nc *natsclient.Conn) {
			b.metrics.connectionStatus.WithLabelValues(roleStr).Set(1)
			b.metrics.reconnects.WithLabelValues(roleStr).Inc()
			b.log.Info("nats reconnected", "role", roleStr, "url", nc.ConnectedUrl())
		}),
		natsclient.ClosedHandler(func(nc *natsclient.Conn) {
			b.metrics.connectionStatus.WithLabelValues(roleStr).Set(0)
			b.log.Info("nats connection closed", "role", roleStr, "last_err", nc.LastError())
		}),
		natsclient.ErrorHandler(func(_ *natsclient.Conn, sub *natsclient.Subscription, err error) {
			if errors.Is(err, natsclient.ErrSlowConsumer) {
				b.metrics.slowConsumers.Inc()
			}
			subject := ""
			if sub != nil {
				subject = sub.Subject
			}
			b.log.Warn("nats async error", "role", roleStr, "subject", subject, "err", err)
		}),
	}

	if b.cfg.TLS.Enabled {
		tc, err := buildTLSConfig(b.cfg.TLS)
		if err != nil {
			return nil, err
		}
		options = append(options, natsclient.Secure(tc))
	}

	// Precedence: per-role creds file > shared creds file > token.
	creds := b.cfg.Auth.PublisherCredentials()
	if role == roleSubscriber {
		creds = b.cfg.Auth.SubscriberCredentials()
	}
	switch {
	case creds != "":
		options = append(options, natsclient.UserCredentials(creds))
	case b.cfg.Auth.Token != "":
		options = append(options, natsclient.Token(b.cfg.Auth.Token))
	}

	return options, nil
}

// close drains both connections so in-flight work flushes before shutdown.
func (b *bus) close() {
	b.publisherMu.Lock()
	if b.publisher != nil && !b.publisher.IsClosed() {
		if err := b.publisher.Drain(); err != nil {
			b.log.Warn("failed to drain nats publisher", "err", err)
		}
	}
	b.publisher = nil
	b.publisherMu.Unlock()

	b.subscriberMu.Lock()
	if b.subscriber != nil && !b.subscriber.IsClosed() {
		if err := b.subscriber.Drain(); err != nil {
			b.log.Warn("failed to drain nats subscriber", "err", err)
		}
	}
	b.subscriber = nil
	b.subscriberMu.Unlock()
}
