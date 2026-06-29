package nats

import (
	"context"
	"errors"
	"sync"

	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/infra/log"
)

// subscription adapts a nats.Subscription to the lean Subscription interface,
// translating *nats.Msg into Message and converting Close into a drain.
type subscription struct {
	sub     *natsclient.Subscription
	out     chan Message
	metrics *metrics
	log     log.Logger

	cancel    context.CancelFunc
	closeOnce sync.Once
	done      chan struct{}
}

func newSubscription(ctx context.Context, sub *natsclient.Subscription, in chan *natsclient.Msg, m *metrics, logger log.Logger) *subscription {
	ctx, cancel := context.WithCancel(ctx)
	s := &subscription{
		sub:     sub,
		out:     make(chan Message, cap(in)),
		metrics: m,
		log:     logger,
		cancel:  cancel,
		done:    make(chan struct{}),
	}

	go s.pump(ctx, in)
	return s
}

func (s *subscription) pump(ctx context.Context, in chan *natsclient.Msg) {
	defer close(s.out)
	defer close(s.done)
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-in:
			if msg == nil {
				// Channel closed by an unsubscribe/drain.
				return
			}
			s.metrics.messagesRecv.Inc()
			select {
			case s.out <- Message{Subject: msg.Subject, Data: msg.Data}:
			case <-ctx.Done():
				return
			}
		}
	}
}

func (s *subscription) C() <-chan Message { return s.out }

func (s *subscription) Close() error {
	var err error
	s.closeOnce.Do(func() {
		// Drain lets messages already buffered in the NATS client be delivered
		// before the subscription is torn down; the pump exits when the input
		// channel closes or the context is cancelled.
		if derr := s.sub.Drain(); derr != nil && !errors.Is(derr, natsclient.ErrConnectionClosed) {
			s.log.Warn("failed to drain nats subscription", "subject", s.sub.Subject, "err", derr)
			err = derr
		}
		s.cancel()
		<-s.done
	})
	return err
}
