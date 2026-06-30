package nats

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type connRole string

const rolePublisher connRole = "publisher"

// connection lazily establishes and reuses a single NATS connection per role,
// so each role can present distinct least-privilege credentials.
type connection struct {
	cfg     setting.NATSSettings
	log     log.Logger
	metrics *metrics
	role    connRole
	// urls and credentials are resolved at connect time: the embedded server URL
	// is only known once it has started.
	urls        func() []string
	credentials func() string

	mu   sync.Mutex
	conn *natsclient.Conn

	optsMu       sync.Mutex
	extraOptions []natsclient.Option
}

func newConnection(role connRole, cfg setting.NATSSettings, logger log.Logger, m *metrics, urls func() []string, credentials func() string) *connection {
	return &connection{
		cfg:         cfg,
		log:         logger,
		metrics:     m,
		role:        role,
		urls:        urls,
		credentials: credentials,
	}
}

func (c *connection) Enabled() bool { return c.cfg.Enabled }

// setExtraOptions must be called before the connection is first used. It injects
// nats.InProcessServer so the local hop to an embedded server bypasses TCP/TLS.
func (c *connection) setExtraOptions(opts ...natsclient.Option) {
	c.optsMu.Lock()
	defer c.optsMu.Unlock()
	c.extraOptions = opts
}

func (c *connection) getExtraOptions() []natsclient.Option {
	c.optsMu.Lock()
	defer c.optsMu.Unlock()
	return c.extraOptions
}

func (c *connection) get(ctx context.Context) (*natsclient.Conn, error) {
	if !c.Enabled() {
		return nil, ErrDisabled
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil && !c.conn.IsClosed() {
		return c.conn, nil
	}
	nc, err := c.connect(ctx)
	if err != nil {
		return nil, err
	}
	c.conn = nc
	return nc, nil
}

func (c *connection) connect(ctx context.Context) (*natsclient.Conn, error) {
	urls := c.urls()
	if len(urls) == 0 {
		return nil, fmt.Errorf("no nats client urls configured")
	}

	options, err := c.connectOptions()
	if err != nil {
		return nil, err
	}
	options = append(options, c.getExtraOptions()...)

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
			c.metrics.connectionErrors.WithLabelValues(string(c.role)).Inc()
			return nil, fmt.Errorf("connect nats %s: %w", c.role, res.err)
		}
		c.metrics.connectionStatus.WithLabelValues(string(c.role)).Set(1)
		return res.conn, nil
	}
}

func (c *connection) connectOptions() ([]natsclient.Option, error) {
	roleStr := string(c.role)
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
			c.metrics.connectionStatus.WithLabelValues(roleStr).Set(0)
			c.metrics.disconnects.WithLabelValues(roleStr).Inc()
			if err != nil {
				c.log.Warn("nats disconnected", "role", roleStr, "err", err)
			}
		}),
		natsclient.ReconnectHandler(func(nc *natsclient.Conn) {
			c.metrics.connectionStatus.WithLabelValues(roleStr).Set(1)
			c.metrics.reconnects.WithLabelValues(roleStr).Inc()
			c.log.Info("nats reconnected", "role", roleStr, "url", nc.ConnectedUrl())
		}),
		natsclient.ClosedHandler(func(nc *natsclient.Conn) {
			c.metrics.connectionStatus.WithLabelValues(roleStr).Set(0)
			c.log.Info("nats connection closed", "role", roleStr, "last_err", nc.LastError())
		}),
		natsclient.ErrorHandler(func(_ *natsclient.Conn, sub *natsclient.Subscription, err error) {
			subject := ""
			if sub != nil {
				subject = sub.Subject
			}
			c.log.Warn("nats async error", "role", roleStr, "subject", subject, "err", err)
		}),
	}

	if c.cfg.TLS.Enabled {
		tc, err := buildTLSConfig(c.cfg.TLS)
		if err != nil {
			return nil, err
		}
		options = append(options, natsclient.Secure(tc))
	}

	// Precedence: per-role creds file > shared creds file > token.
	switch creds := c.credentials(); {
	case creds != "":
		options = append(options, natsclient.UserCredentials(creds))
	case c.cfg.Auth.Token != "":
		options = append(options, natsclient.Token(c.cfg.Auth.Token))
	}

	return options, nil
}

// close drains the connection so in-flight work flushes before shutdown.
func (c *connection) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil && !c.conn.IsClosed() {
		if err := c.conn.Drain(); err != nil {
			c.log.Warn("failed to drain nats connection", "role", c.role, "err", err)
		}
	}
	c.conn = nil
}
