package nats

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/infra/log"
)

type connRole string

const (
	rolePublisher  connRole = "publisher"
	roleSubscriber connRole = "subscriber"
)

// drainTimeout bounds how long close() waits for in-flight work to flush, so a
// broker that has gone away cannot stall shutdown for the nats.go default of 30s.
const drainTimeout = 10 * time.Second

// connection lazily establishes and reuses a single NATS connection per role for least-privilege credentials.
type connection struct {
	log         log.Logger
	metrics     connectionMetrics
	role        connRole
	config      *Config
	credentials func() string

	// onAsyncError, when set, is invoked from the NATS async error handler after logging.
	onAsyncError func(error)

	// disconnectedAt holds the unix-nano timestamp of the last disconnect so the
	// reconnect handler can record how long the connection was down. Accessed only
	// from the NATS callback goroutine, but kept atomic to stay race-free.
	disconnectedAt atomic.Int64

	mu     sync.Mutex
	conn   *natsclient.Conn
	closed bool
}

func newConnection(role connRole, logger log.Logger, m connectionMetrics, config *Config, credentials func() string) *connection {
	return &connection{
		log:         logger,
		metrics:     m,
		role:        role,
		config:      config,
		credentials: credentials,
	}
}

func (c *connection) Enabled() bool { return c.config.Enabled() }

func (c *connection) get(ctx context.Context) (*natsclient.Conn, error) {
	if !c.Enabled() {
		return nil, ErrDisabled
	}
	// Honour cancellation even on the warm path, where no dial happens.
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil, ErrClosed
	}
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
	urls := c.config.URLs()
	if len(urls) == 0 {
		return nil, fmt.Errorf("no nats client urls configured")
	}

	options, err := c.connectOptions()
	if err != nil {
		return nil, err
	}
	options = append(options, c.config.DialOptions()...)

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
		// The dial goroutine may still be in flight. Drain its result and close
		// any connection it produces, otherwise it is orphaned and would reconnect
		// forever in the background (MaxReconnects(-1)).
		go func() {
			if res := <-ch; res.conn != nil {
				res.conn.Close()
			}
		}()
		return nil, ctx.Err()
	case res := <-ch:
		if res.err != nil {
			c.metrics.connectionErrors.Inc()
			return nil, fmt.Errorf("connect nats %s: %w", c.role, res.err)
		}
		// connectionStatus is driven solely by the connect/reconnect/disconnect
		// handlers: with RetryOnFailedConnect the conn returned here may still be
		// dialing in the background, so setting it to 1 now would report a healthy
		// connection that is not yet established.
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
		natsclient.DrainTimeout(drainTimeout),
		// Disable the reconnect buffer: rather than silently buffering up to the
		// 8MB default during an outage fail publishes fast.
		natsclient.ReconnectBufSize(-1),
		natsclient.ConnectHandler(func(nc *natsclient.Conn) {
			c.metrics.connectionStatus.Set(1)
			c.log.Info("nats connected", "role", roleStr, "url", nc.ConnectedUrl())
		}),
		natsclient.DisconnectErrHandler(func(_ *natsclient.Conn, err error) {
			c.metrics.connectionStatus.Set(0)
			c.metrics.disconnects.Inc()
			c.disconnectedAt.Store(time.Now().UnixNano())
			if err != nil {
				c.log.Warn("nats disconnected", "role", roleStr, "err", err)
			}
		}),
		natsclient.ReconnectHandler(func(nc *natsclient.Conn) {
			c.metrics.connectionStatus.Set(1)
			c.metrics.reconnects.Inc()
			if down := c.disconnectedAt.Swap(0); down != 0 {
				c.metrics.disconnectedSeconds.Observe(time.Since(time.Unix(0, down)).Seconds())
			}
			c.log.Info("nats reconnected", "role", roleStr, "url", nc.ConnectedUrl())
		}),
		natsclient.ClosedHandler(func(nc *natsclient.Conn) {
			c.metrics.connectionStatus.Set(0)
			c.log.Info("nats connection closed", "role", roleStr, "last_err", nc.LastError())
		}),
		natsclient.ErrorHandler(func(_ *natsclient.Conn, sub *natsclient.Subscription, err error) {
			subject := ""
			if sub != nil {
				subject = sub.Subject
			}
			c.log.Warn("nats async error", "role", roleStr, "subject", subject, "err", err)
			if c.onAsyncError != nil {
				c.onAsyncError(err)
			}
		}),
	}

	if tls := c.config.TLS(); tls.Enabled {
		tc, err := buildTLSConfig(tls)
		if err != nil {
			return nil, err
		}
		options = append(options, natsclient.Secure(tc))
	}

	// Precedence: per-role creds file > shared creds file > token.
	switch creds := c.credentials(); {
	case creds != "":
		options = append(options, natsclient.UserCredentials(creds))
	case c.config.Token() != "":
		options = append(options, natsclient.Token(c.config.Token()))
	}

	return options, nil
}

// healthy reports whether the connection is usable. It tolerates the lazy state
// before first use (conn == nil): an idle service that has never published is
// not a failure. Once a connection exists, it must actually be connected.
func (c *connection) healthy() error {
	if !c.Enabled() {
		return ErrDisabled
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return ErrClosed
	}
	if c.conn == nil {
		return nil
	}
	if !c.conn.IsConnected() {
		return fmt.Errorf("nats %s connection is not connected (status=%s)", c.role, c.conn.Status())
	}
	return nil
}

// close drains the connection so in-flight work flushes before shutdown. It is
// terminal: once closed, get() refuses to reopen a connection.
func (c *connection) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.closed = true
	if c.conn != nil && !c.conn.IsClosed() {
		if err := c.conn.Drain(); err != nil {
			c.log.Warn("failed to drain nats connection", "role", c.role, "err", err)
		}
	}
	c.conn = nil
}
