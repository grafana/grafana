package nats

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/dskit/services"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const subscriberName = "nats-subscriber"

// MessageHandler receives a message delivered to a subscribed subject. It
// mirrors Publish's (subject, data) shape so callers never touch nats.go types.
type MessageHandler func(subject string, data []byte)

// Subscription is a handle to an active subscription. Unsubscribe stops delivery
// and releases the server-side interest.
type Subscription interface {
	Unsubscribe() error
}

// Subscriber hides nats.go types so callers can mock it.
type Subscriber interface {
	Enabled() bool
	// Subscribe delivers every matching message to handler. By default each
	// running subscriber receives its own copy; pass WithQueueGroup to
	// load-balance delivery across a group instead.
	Subscribe(ctx context.Context, subject string, handler MessageHandler, opts ...SubscribeOption) (Subscription, error)
}

// subscribeConfig holds the resolved options for a Subscribe call.
type subscribeConfig struct {
	queue string
}

// SubscribeOption customises a single Subscribe call.
type SubscribeOption func(*subscribeConfig)

// WithQueueGroup joins the named queue group so the broker load-balances
// matching messages across every subscriber in the group: each message is
// handled once per group rather than once per subscriber.
func WithQueueGroup(queue string) SubscribeOption {
	return func(c *subscribeConfig) { c.queue = queue }
}

// SubscriberService owns the subscriber lifecycle and implements Subscriber. It is a dskit service that bridges to the monolith background-service contract via Run.
type SubscriberService struct {
	services.NamedService
	*connection
	metrics *subscriberMetrics
}

func newSubscriber(logger log.Logger, m *subscriberMetrics, config *Config, credentials func() string) *SubscriberService {
	conn := newConnection(roleSubscriber, logger, m.connectionMetrics, config, credentials)
	// A slow consumer means the broker dropped messages the client could not drain in time.
	conn.onAsyncError = func(err error) {
		if errors.Is(err, natsclient.ErrSlowConsumer) {
			m.slowConsumers.Inc()
		}
	}
	s := &SubscriberService{connection: conn, metrics: m}
	s.NamedService = services.NewBasicService(nil, s.running, s.stopping).WithName(subscriberName)
	return s
}

// ProvideSubscriber builds the subscriber from the shared connection config
// (which carries the bus config and resolves the mode) plus its per-role
// credentials, registering its own metrics.
func ProvideSubscriber(cfg *setting.Cfg, config *Config, reg prometheus.Registerer) *SubscriberService {
	return newSubscriber(log.New("infra.nats.subscriber"), newSubscriberMetrics(reg), config, cfg.NATS.Auth.SubscriberCredentials)
}

func (s *SubscriberService) IsDisabled() bool {
	return !s.Enabled()
}

// Run bridges the dskit service into the monolith background-service contract.
func (s *SubscriberService) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(ctx)
}

func (s *SubscriberService) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

// stopping drains the connection, which auto-unsubscribes any active
// subscriptions and flushes in-flight handler deliveries.
func (s *SubscriberService) stopping(_ error) error {
	s.close()
	return nil
}

func (s *SubscriberService) Health(_ context.Context) error {
	return s.healthy()
}

func (s *SubscriberService) Subscribe(ctx context.Context, subject string, handler MessageHandler, opts ...SubscribeOption) (Subscription, error) {
	var cfg subscribeConfig
	for _, opt := range opts {
		opt(&cfg)
	}
	return s.subscribe(ctx, subject, func(nc *natsclient.Conn, cb natsclient.MsgHandler) (*natsclient.Subscription, error) {
		if cfg.queue != "" {
			return nc.QueueSubscribe(subject, cfg.queue, cb)
		}
		return nc.Subscribe(subject, cb)
	}, handler)
}

// subscribe centralises the connection lookup, the metrics-instrumented handler
// wrapper, and error accounting shared by Subscribe and QueueSubscribe. The nats
// client re-establishes the subscription automatically on reconnect.
func (s *SubscriberService) subscribe(ctx context.Context, subject string, sub func(*natsclient.Conn, natsclient.MsgHandler) (*natsclient.Subscription, error), handler MessageHandler) (Subscription, error) {
	nc, err := s.get(ctx)
	if err != nil {
		return nil, err
	}
	cb := func(msg *natsclient.Msg) {
		s.metrics.messagesReceived.Inc()
		start := time.Now()
		handler(msg.Subject, msg.Data)
		s.metrics.handlerDuration.Observe(time.Since(start).Seconds())
	}
	natsSub, err := sub(nc, cb)
	if err != nil {
		s.metrics.subscribeErrors.Inc()
		return nil, fmt.Errorf("subscribe to %q: %w", subject, err)
	}
	return natsSub, nil
}
