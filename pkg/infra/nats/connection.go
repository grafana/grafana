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
	"github.com/grafana/grafana/pkg/setting"
)

// tokenExchangeTimeout bounds a single access-token mint so a slow or unreachable
// signer cannot stall a (re)connect indefinitely.
const tokenExchangeTimeout = 5 * time.Second

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

	mu       sync.Mutex
	conn     *natsclient.Conn
	closed   bool
	nextCbID int
	// reconnectCbs holds callbacks registered by subscriptions, invoked after the
	// connection re-establishes (the nats client auto-resumes the subscriptions,
	// but a caller may still want to reconcile events missed while it was down).
	reconnectCbs map[int]func()
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

// onReconnect registers fn to run after each reconnect and returns a function
// that unregisters it. fn must not block: it runs on the NATS client's reconnect
// goroutine.
func (c *connection) onReconnect(fn func()) (remove func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.reconnectCbs == nil {
		c.reconnectCbs = map[int]func(){}
	}
	id := c.nextCbID
	c.nextCbID++
	c.reconnectCbs[id] = fn
	return func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		delete(c.reconnectCbs, id)
	}
}

// fireReconnect invokes every registered reconnect callback. It snapshots the
// callbacks under the lock and calls them outside it, so a callback can register
// or remove others without deadlocking.
func (c *connection) fireReconnect() {
	c.mu.Lock()
	fns := make([]func(), 0, len(c.reconnectCbs))
	for _, fn := range c.reconnectCbs {
		fns = append(fns, fn)
	}
	c.mu.Unlock()
	for _, fn := range fns {
		fn()
	}
}

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
			c.fireReconnect()
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

	// The auth mechanism is selected explicitly by mode, not inferred from which
	// fields are populated. For token exchange, TokenHandler is invoked on every
	// (re)connect so the minted token is always fresh; the authlib client caches
	// it under the hood.
	switch c.config.AuthMode() {
	case setting.NATSAuthModeCredentials:
		options = append(options, natsclient.UserCredentials(c.credentials()))
	case setting.NATSAuthModeTokenExchange:
		options = append(options, natsclient.TokenHandler(c.tokenHandler))
	case setting.NATSAuthModeToken:
		options = append(options, natsclient.Token(c.config.Token()))
	case setting.NATSAuthModeNone:
	}

	return options, nil
}

// tokenHandler mints a fresh access token for this connection. It satisfies
// nats.TokenHandler, which cannot return an error: on failure it logs and
// returns an empty token, letting the server reject the connect so the client
// retries rather than silently proceeding unauthenticated.
func (c *connection) tokenHandler() string {
	ctx, cancel := context.WithTimeout(context.Background(), tokenExchangeTimeout)
	defer cancel()
	token, err := c.config.exchangeAccessToken(ctx)
	if err != nil {
		c.log.Error("nats access-token exchange failed", "role", c.role, "err", err)
		return ""
	}
	return token
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

// close drains the connection and waits for the drain to complete so it does not
// outlive the caller. Terminal: once closed, get() refuses to reopen.
func (c *connection) close() {
	// Drain outside the lock: waiting for it can take up to drainTimeout, and
	// holding c.mu that long would stall a concurrent Health().
	c.mu.Lock()
	nc := c.conn
	c.conn = nil
	c.closed = true
	c.mu.Unlock()

	if nc == nil || nc.IsClosed() {
		return
	}

	// Drain closes the connection on a background goroutine; wait for it below.
	if err := nc.Drain(); err != nil {
		c.log.Warn("failed to drain nats connection", "role", c.role, "err", err)
		nc.Close()
		return
	}

	// A broker that has gone away never closes, so force it at the deadline.
	deadline := time.Now().Add(drainTimeout + time.Second)
	for !nc.IsClosed() {
		if time.Now().After(deadline) {
			c.log.Warn("nats connection did not close within drain timeout; forcing close", "role", c.role)
			nc.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
}
