package redis

import (
	"errors"
	"log"
	"net"
	"strings"
	"sync"
	"time"
)

//------------------------------------------------------------------------------

type FailoverOptions struct {
	MasterName    string
	SentinelAddrs []string

	Password string
	DB       int64

	PoolSize int

	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

func (opt *FailoverOptions) getPoolSize() int {
	if opt.PoolSize == 0 {
		return 10
	}
	return opt.PoolSize
}

func (opt *FailoverOptions) getDialTimeout() time.Duration {
	if opt.DialTimeout == 0 {
		return 5 * time.Second
	}
	return opt.DialTimeout
}

func (opt *FailoverOptions) options() *options {
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

func NewFailoverClient(failoverOpt *FailoverOptions) *Client {
	opt := failoverOpt.options()
	failover := &sentinelFailover{
		masterName:    failoverOpt.MasterName,
		sentinelAddrs: failoverOpt.SentinelAddrs,

		opt: opt,
	}
	return &Client{
		baseClient: &baseClient{
			opt:      opt,
			connPool: failover.Pool(),
		},
	}
}

//------------------------------------------------------------------------------

type sentinelClient struct {
	*baseClient
}

func newSentinel(clOpt *Options) *sentinelClient {
	opt := clOpt.options()
	opt.Password = ""
	opt.DB = 0
	dialer := func() (net.Conn, error) {
		return net.DialTimeout("tcp", clOpt.Addr, opt.DialTimeout)
	}
	return &sentinelClient{
		baseClient: &baseClient{
			opt:      opt,
			connPool: newConnPool(newConnFunc(dialer), opt),
		},
	}
}

func (c *sentinelClient) PubSub() *PubSub {
	return &PubSub{
		baseClient: &baseClient{
			opt:      c.opt,
			connPool: newSingleConnPool(c.connPool, false),
		},
	}
}

func (c *sentinelClient) GetMasterAddrByName(name string) *StringSliceCmd {
	cmd := NewStringSliceCmd("SENTINEL", "get-master-addr-by-name", name)
	c.Process(cmd)
	return cmd
}

func (c *sentinelClient) Sentinels(name string) *SliceCmd {
	cmd := NewSliceCmd("SENTINEL", "sentinels", name)
	c.Process(cmd)
	return cmd
}

type sentinelFailover struct {
	masterName    string
	sentinelAddrs []string

	opt *options

	pool     pool
	poolOnce sync.Once

	lock      sync.RWMutex
	_sentinel *sentinelClient
}

func (d *sentinelFailover) dial() (net.Conn, error) {
	addr, err := d.MasterAddr()
	if err != nil {
		return nil, err
	}
	return net.DialTimeout("tcp", addr, d.opt.DialTimeout)
}

func (d *sentinelFailover) Pool() pool {
	d.poolOnce.Do(func() {
		d.pool = newConnPool(newConnFunc(d.dial), d.opt)
	})
	return d.pool
}

func (d *sentinelFailover) MasterAddr() (string, error) {
	defer d.lock.Unlock()
	d.lock.Lock()

	// Try last working sentinel.
	if d._sentinel != nil {
		addr, err := d._sentinel.GetMasterAddrByName(d.masterName).Result()
		if err != nil {
			log.Printf("redis-sentinel: GetMasterAddrByName %q failed: %s", d.masterName, err)
			d.resetSentinel()
		} else {
			addr := net.JoinHostPort(addr[0], addr[1])
			log.Printf("redis-sentinel: %q addr is %s", d.masterName, addr)
			return addr, nil
		}
	}

	for i, sentinelAddr := range d.sentinelAddrs {
		sentinel := newSentinel(&Options{
			Addr: sentinelAddr,

			DB:       d.opt.DB,
			Password: d.opt.Password,

			DialTimeout:  d.opt.DialTimeout,
			ReadTimeout:  d.opt.ReadTimeout,
			WriteTimeout: d.opt.WriteTimeout,

			PoolSize:    d.opt.PoolSize,
			IdleTimeout: d.opt.IdleTimeout,
		})
		masterAddr, err := sentinel.GetMasterAddrByName(d.masterName).Result()
		if err != nil {
			log.Printf("redis-sentinel: GetMasterAddrByName %q failed: %s", d.masterName, err)
			sentinel.Close()
			continue
		}

		// Push working sentinel to the top.
		d.sentinelAddrs[0], d.sentinelAddrs[i] = d.sentinelAddrs[i], d.sentinelAddrs[0]

		d.setSentinel(sentinel)
		addr := net.JoinHostPort(masterAddr[0], masterAddr[1])
		log.Printf("redis-sentinel: %q addr is %s", d.masterName, addr)
		return addr, nil
	}

	return "", errors.New("redis: all sentinels are unreachable")
}

func (d *sentinelFailover) setSentinel(sentinel *sentinelClient) {
	d.discoverSentinels(sentinel)
	d._sentinel = sentinel
	go d.listen()
}

func (d *sentinelFailover) discoverSentinels(sentinel *sentinelClient) {
	sentinels, err := sentinel.Sentinels(d.masterName).Result()
	if err != nil {
		log.Printf("redis-sentinel: Sentinels %q failed: %s", d.masterName, err)
		return
	}
	for _, sentinel := range sentinels {
		vals := sentinel.([]interface{})
		for i := 0; i < len(vals); i += 2 {
			key := vals[i].(string)
			if key == "name" {
				sentinelAddr := vals[i+1].(string)
				if !contains(d.sentinelAddrs, sentinelAddr) {
					log.Printf(
						"redis-sentinel: discovered new %q sentinel: %s",
						d.masterName, sentinelAddr,
					)
					d.sentinelAddrs = append(d.sentinelAddrs, sentinelAddr)
				}
			}
		}
	}
}

func (d *sentinelFailover) listen() {
	var pubsub *PubSub
	for {
		if pubsub == nil {
			pubsub = d._sentinel.PubSub()
			if err := pubsub.Subscribe("+switch-master"); err != nil {
				log.Printf("redis-sentinel: Subscribe failed: %s", err)
				d.lock.Lock()
				d.resetSentinel()
				d.lock.Unlock()
				return
			}
		}

		msgIface, err := pubsub.Receive()
		if err != nil {
			log.Printf("redis-sentinel: Receive failed: %s", err)
			pubsub.Close()
			return
		}

		switch msg := msgIface.(type) {
		case *Message:
			switch msg.Channel {
			case "+switch-master":
				parts := strings.Split(msg.Payload, " ")
				if parts[0] != d.masterName {
					log.Printf("redis-sentinel: ignore new %s addr", parts[0])
					continue
				}
				addr := net.JoinHostPort(parts[3], parts[4])
				log.Printf(
					"redis-sentinel: new %q addr is %s",
					d.masterName, addr,
				)
				d.pool.Filter(func(cn *conn) bool {
					if cn.RemoteAddr().String() != addr {
						log.Printf(
							"redis-sentinel: closing connection to old master %s",
							cn.RemoteAddr(),
						)
						return false
					}
					return true
				})
			default:
				log.Printf("redis-sentinel: unsupported message: %s", msg)
			}
		case *Subscription:
			// Ignore.
		default:
			log.Printf("redis-sentinel: unsupported message: %s", msgIface)
		}
	}
}

func (d *sentinelFailover) resetSentinel() {
	d._sentinel.Close()
	d._sentinel = nil
}

func contains(slice []string, str string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}
