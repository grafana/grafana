package nats

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/setting"
)

const (
	defaultDiscoverySection = "nats/peers"
)

var ErrDisabled = errors.New("nats is disabled")

type ClientProvider interface {
	Enabled() bool
	Connect(ctx context.Context, token string, opts ...natsclient.Option) (*natsclient.Conn, error)
	Publisher(ctx context.Context) (*natsclient.Conn, error)
	Subscriber(ctx context.Context) (*natsclient.Conn, error)
}

type clientProvider struct {
	cfg  setting.NATSSettings
	urls func() []string

	publisherMu sync.Mutex
	publisher   *natsclient.Conn

	subscriberMu sync.Mutex
	subscriber   *natsclient.Conn
}

func (p *clientProvider) Enabled() bool {
	return p.cfg.Enabled
}

func (p *clientProvider) Publisher(ctx context.Context) (*natsclient.Conn, error) {
	if !p.Enabled() {
		return nil, ErrDisabled
	}

	p.publisherMu.Lock()
	defer p.publisherMu.Unlock()

	if p.publisher != nil && !p.publisher.IsClosed() {
		return p.publisher, nil
	}

	nc, err := p.Connect(ctx, "", natsclient.Name("grafana-nats-publisher"))
	if err != nil {
		return nil, err
	}
	p.publisher = nc
	return nc, nil
}

func (p *clientProvider) Subscriber(ctx context.Context) (*natsclient.Conn, error) {
	if !p.Enabled() {
		return nil, ErrDisabled
	}

	p.subscriberMu.Lock()
	defer p.subscriberMu.Unlock()

	if p.subscriber != nil && !p.subscriber.IsClosed() {
		return p.subscriber, nil
	}

	nc, err := p.Connect(ctx, "", natsclient.Name("grafana-nats-subscriber"))
	if err != nil {
		return nil, err
	}
	p.subscriber = nc
	return nc, nil
}

func (p *clientProvider) Connect(ctx context.Context, token string, opts ...natsclient.Option) (*natsclient.Conn, error) {
	if !p.Enabled() {
		return nil, ErrDisabled
	}

	urls := p.urls()
	if len(urls) == 0 {
		return nil, fmt.Errorf("no nats client urls configured")
	}

	options := []natsclient.Option{
		natsclient.Timeout(5 * time.Second),
		natsclient.RetryOnFailedConnect(true),
		natsclient.MaxReconnects(-1),
		natsclient.DisconnectErrHandler(func(_ *natsclient.Conn, _ error) {}),
	}
	if token != "" {
		options = append(options, natsclient.Token(token))
	}
	options = append(options, opts...)

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
		return res.conn, res.err
	}
}
