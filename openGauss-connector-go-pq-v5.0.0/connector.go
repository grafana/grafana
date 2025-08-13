package pq

import (
	"bufio"
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"
)

// Compile time validation that our types implement the expected interfaces
var (
	_ driver.Driver = Driver{}
)

// Driver is the Postgres database driver.
type Driver struct{}

func init() {
	sql.Register("opengauss", &Driver{})
	sql.Register("mogdb", &Driver{})
	sql.Register("postgres", &Driver{})
}

// Open opens a new connection to the database. name is a connection string.
// Most users should only use it through database/sql package from the standard
// library.
func (d Driver) Open(name string) (driver.Conn, error) {
	return Open(name)
}

// DialFunc is a function that can be used to connect to a PostgreSQL server.
type DialFunc func(ctx context.Context, network, addr string) (net.Conn, error)

// BuildFrontendFunc is a function that can be used to create Frontend implementation for connection.
// type BuildFrontendFunc func(r io.Reader, w io.Writer) Frontend

// LookupFunc is a function that can be used to lookup IPs addrs from host.
type LookupFunc func(ctx context.Context, host string) (addrs []string, err error)

// Dialer is the dialer interface. It can be used to obtain more control over
// how pq creates network connections.
type Dialer interface {
	Dial(network, address string) (net.Conn, error)
	DialTimeout(network, address string, timeout time.Duration) (net.Conn, error)
}

// DialerContext is the context-aware dialer interface.
type DialerContext interface {
	DialContext(ctx context.Context, network, address string) (net.Conn, error)
}

type defaultDialer struct {
	d net.Dialer
}

func (d defaultDialer) Dial(network, address string) (net.Conn, error) {
	return d.d.Dial(network, address)
}
func (d defaultDialer) DialTimeout(network, address string, timeout time.Duration) (net.Conn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return d.DialContext(ctx, network, address)
}
func (d defaultDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	return d.d.DialContext(ctx, network, address)
}

// Connector represents a fixed configuration for the pq driver with a given
// name. Connector satisfies the database/sql/driver Connector interface and
// can be used to create any number of DB Conn's via the database/sql OpenDB
// function.
//
// See https://golang.org/pkg/database/sql/driver/#Connector.
// See https://golang.org/pkg/database/sql/#OpenDB.
type Connector struct {
	dialer Dialer
	config *Config
}

// Connect returns a connection to the database using the fixed configuration
// of this Connector. Context is not used.
func (c *Connector) Connect(ctx context.Context) (driver.Conn, error) {
	return c.open(ctx)
}

// Driver returns the underlying driver of this Connector.
func (c *Connector) Driver() driver.Driver {
	return &Driver{}
}

// NewConnector returns a connector for the pq driver in a fixed configuration
// with the given dsn. The returned connector can be used to create any number
// of equivalent Conn's. The returned connector is intended to be used with
// database/sql.OpenDB.
//
// See https://golang.org/pkg/database/sql/driver/#Connector.
// See https://golang.org/pkg/database/sql/#OpenDB.
func NewConnector(dsn string) (*Connector, error) {
	config, err := ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	return newConnector(config)
}

// NewConnectorConfig establishes a connection to a openGauss server using config.
// config must have been constructed with ParseConfig.
func NewConnectorConfig(config *Config) (*Connector, error) {
	return newConnector(config)
}

func newConnector(config *Config) (*Connector, error) {
	return &Connector{dialer: defaultDialer{}, config: config}, nil
}

// Open opens a new connection to the database. dsn is a connection string.
// Most users should only use it through database/sql package from the standard
// library.
func Open(dsn string) (_ driver.Conn, err error) {
	return DialOpen(defaultDialer{}, dsn)
}

// DialOpen opens a new connection to the database using a dialer.
func DialOpen(d Dialer, dsn string) (_ driver.Conn, err error) {
	c, err := NewConnector(dsn)
	if err != nil {
		return nil, err
	}
	c.dialer = d
	return c.open(context.Background())
}

func (c *Connector) open(ctx context.Context) (cn *conn, err error) {
	return c.connectConfig(ctx, c.config)
}

func (c *Connector) connectConfig(ctx context.Context, config *Config) (cn *conn, err error) {
	if !config.createdByParseConfig {
		return nil, errors.New("config must be created by ParseConfig")
	}
	return c.connect(ctx, config)
}

func (c *Connector) connect(ctx context.Context, config *Config) (cn *conn, err error) {
	// ConnectTimeout restricts the whole connection process.
	defer errRecoverNoErrBadConn(&err)

	if config.ConnectTimeout != 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, config.ConnectTimeout)
		defer cancel()
	}
	// Simplify usage by treating primary config and fallbacks the same.
	fallbackConfigs := []*FallbackConfig{
		{
			Host:      config.Host,
			Port:      config.Port,
			TLSConfig: config.TLSConfig,
		},
	}

	fallbackConfigs = append(fallbackConfigs, config.Fallbacks...)

	fallbackConfigs, err = expandWithIPs(ctx, config.LookupFunc, fallbackConfigs)
	if err != nil {
		return nil, &connectError{config: config, msg: "hostname resolving error", err: err}
	}

	if len(fallbackConfigs) == 0 {
		return nil, &connectError{
			config: config, msg: "hostname resolving error",
			err: errors.New("ip addr wasn't found"),
		}
	}
	for _, fc := range fallbackConfigs {

		cn, err = c.connectFallbackConfig(ctx, config, fc)
		if err != nil {
			if pgErr, ok := err.(*Error); ok {
				err = &connectError{config: config, msg: "server error", fallbackConfig: fc, err: pgErr}
				ErrCodeInvalidPassword := "28P01"                   // wrong password
				ErrCodeInvalidAuthorizationSpecification := "28000" // db does not exist
				if pgErr.Code.String() == ErrCodeInvalidPassword ||
					pgErr.Code.String() == ErrCodeInvalidAuthorizationSpecification {
					break
				}
			}
			if config.shouldLog(LogLevelDebug) {
				config.Logger.Log(context.Background(), LogLevelDebug, err.Error(), map[string]interface{}{
					"host": fc.Host, "port": fc.Port})
			}
			continue
		}
		if config.shouldLog(LogLevelDebug) {
			config.Logger.Log(context.Background(), LogLevelDebug, "find instance", map[string]interface{}{
				"host": fc.Host, "port": fc.Port})
		}
		break

	}

	if err != nil {
		return nil, err // no need to wrap in connectError because it will already be wrapped in all cases except PgError
	}
	if cn == nil {
		return nil, fmt.Errorf("connect failed. please check connect string")
	}

	return cn, nil
}

func (c *Connector) connectFallbackConfig(
	ctx context.Context, config *Config, fallbackConfig *FallbackConfig,
) (cn *conn, err error) {
	cn = &conn{
		config:         config,
		logLevel:       config.LogLevel,
		logger:         config.Logger,
		fallbackConfig: fallbackConfig,
	}
	cn.scratch = make([]byte, config.minReadBufferSize)
	cn.log(
		ctx, LogLevelInfo, "dialing server",
		map[string]interface{}{paramHost: fallbackConfig.Host, paramPort: fallbackConfig.Port},
	)
	network, address := NetworkAddress(fallbackConfig.Host, fallbackConfig.Port)
	cn.c, err = config.DialFunc(ctx, network, address)
	if err != nil {
		return nil, &connectError{config: config, msg: "dial error", err: err, fallbackConfig: fallbackConfig}
	}
	if fallbackConfig.TLSConfig != nil {
		if err := cn.startTLS(fallbackConfig.TLSConfig); err != nil {
			cn.c.Close()
			return nil, &connectError{config: config, msg: "tls error", err: err, fallbackConfig: fallbackConfig}
		}
	}
	panicking := true
	defer func() {
		if panicking {
			cn.c.Close()
		}
	}()

	cn.buf = bufio.NewReader(cn.c)
	defer cn.errRecover(&err) // 捕获panic
	cn.startup()

	// reset the deadline, in case one was set (see dial)
	if c.config.ConnectTimeout.Seconds() > 0 {
		err = cn.c.SetDeadline(time.Time{})
	}
	panicking = false
	return cn, err
}

func expandWithIPs(ctx context.Context, lookupFn LookupFunc, fallbacks []*FallbackConfig) ([]*FallbackConfig, error) {
	var configs []*FallbackConfig

	for _, fb := range fallbacks {
		// skip resolve for unix sockets
		if strings.HasPrefix(fb.Host, "/") {
			configs = append(
				configs, &FallbackConfig{
					Host:      fb.Host,
					Port:      fb.Port,
					TLSConfig: fb.TLSConfig,
				},
			)

			continue
		}

		ips, err := lookupFn(ctx, fb.Host)
		if err != nil {
			return nil, err
		}

		for _, ip := range ips {
			configs = append(
				configs, &FallbackConfig{
					Host:      ip,
					Port:      fb.Port,
					TLSConfig: fb.TLSConfig,
				},
			)
		}
	}

	return configs, nil
}
