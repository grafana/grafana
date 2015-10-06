package redis

import (
	"log"
	"net"
	"time"
)

type baseClient struct {
	connPool pool
	opt      *options
	cmds     []Cmder
}

func (c *baseClient) writeCmd(cn *conn, cmds ...Cmder) error {
	buf := cn.buf[:0]
	for _, cmd := range cmds {
		buf = appendArgs(buf, cmd.args())
	}

	_, err := cn.Write(buf)
	return err
}

func (c *baseClient) conn() (*conn, error) {
	cn, isNew, err := c.connPool.Get()
	if err != nil {
		return nil, err
	}

	if isNew {
		if err := c.initConn(cn); err != nil {
			c.removeConn(cn)
			return nil, err
		}
	}

	return cn, nil
}

func (c *baseClient) initConn(cn *conn) error {
	if c.opt.Password == "" && c.opt.DB == 0 {
		return nil
	}

	pool := newSingleConnPool(c.connPool, false)
	pool.SetConn(cn)

	// Client is not closed because we want to reuse underlying connection.
	client := &Client{
		baseClient: &baseClient{
			opt:      c.opt,
			connPool: pool,
		},
	}

	if c.opt.Password != "" {
		if err := client.Auth(c.opt.Password).Err(); err != nil {
			return err
		}
	}

	if c.opt.DB > 0 {
		if err := client.Select(c.opt.DB).Err(); err != nil {
			return err
		}
	}

	return nil
}

func (c *baseClient) freeConn(cn *conn, ei error) error {
	if cn.rd.Buffered() > 0 {
		return c.connPool.Remove(cn)
	}
	if _, ok := ei.(redisError); ok {
		return c.connPool.Put(cn)
	}
	return c.connPool.Remove(cn)
}

func (c *baseClient) removeConn(cn *conn) {
	if err := c.connPool.Remove(cn); err != nil {
		log.Printf("pool.Remove failed: %s", err)
	}
}

func (c *baseClient) putConn(cn *conn) {
	if err := c.connPool.Put(cn); err != nil {
		log.Printf("pool.Put failed: %s", err)
	}
}

func (c *baseClient) Process(cmd Cmder) {
	if c.cmds == nil {
		c.run(cmd)
	} else {
		c.cmds = append(c.cmds, cmd)
	}
}

func (c *baseClient) run(cmd Cmder) {
	cn, err := c.conn()
	if err != nil {
		cmd.setErr(err)
		return
	}

	if timeout := cmd.writeTimeout(); timeout != nil {
		cn.writeTimeout = *timeout
	} else {
		cn.writeTimeout = c.opt.WriteTimeout
	}

	if timeout := cmd.readTimeout(); timeout != nil {
		cn.readTimeout = *timeout
	} else {
		cn.readTimeout = c.opt.ReadTimeout
	}

	if err := c.writeCmd(cn, cmd); err != nil {
		c.freeConn(cn, err)
		cmd.setErr(err)
		return
	}

	if err := cmd.parseReply(cn.rd); err != nil {
		c.freeConn(cn, err)
		return
	}

	c.putConn(cn)
}

// Close closes the client, releasing any open resources.
func (c *baseClient) Close() error {
	return c.connPool.Close()
}

//------------------------------------------------------------------------------

type options struct {
	Password string
	DB       int64

	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration

	PoolSize    int
	IdleTimeout time.Duration
}

type Options struct {
	Network string
	Addr    string

	// Dialer creates new network connection and has priority over
	// Network and Addr options.
	Dialer func() (net.Conn, error)

	Password string
	DB       int64

	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration

	PoolSize    int
	IdleTimeout time.Duration
}

func (opt *Options) getPoolSize() int {
	if opt.PoolSize == 0 {
		return 10
	}
	return opt.PoolSize
}

func (opt *Options) getDialTimeout() time.Duration {
	if opt.DialTimeout == 0 {
		return 5 * time.Second
	}
	return opt.DialTimeout
}

func (opt *Options) options() *options {
	return &options{
		DB:       opt.DB,
		Password: opt.Password,

		DialTimeout:  opt.getDialTimeout(),
		ReadTimeout:  opt.ReadTimeout,
		WriteTimeout: opt.WriteTimeout,

		PoolSize:    opt.getPoolSize(),
		IdleTimeout: opt.IdleTimeout,
	}
}

type Client struct {
	*baseClient
}

func NewClient(clOpt *Options) *Client {
	opt := clOpt.options()
	dialer := clOpt.Dialer
	if dialer == nil {
		dialer = func() (net.Conn, error) {
			return net.DialTimeout(clOpt.Network, clOpt.Addr, opt.DialTimeout)
		}
	}
	return &Client{
		baseClient: &baseClient{
			opt:      opt,
			connPool: newConnPool(newConnFunc(dialer), opt),
		},
	}
}

// Deprecated. Use NewClient instead.
func NewTCPClient(opt *Options) *Client {
	opt.Network = "tcp"
	return NewClient(opt)
}

// Deprecated. Use NewClient instead.
func NewUnixClient(opt *Options) *Client {
	opt.Network = "unix"
	return NewClient(opt)
}
