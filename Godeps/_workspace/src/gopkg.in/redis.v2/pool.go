package redis

import (
	"container/list"
	"errors"
	"log"
	"net"
	"sync"
	"time"

	"gopkg.in/bufio.v1"
)

var (
	errClosed      = errors.New("redis: client is closed")
	errRateLimited = errors.New("redis: you open connections too fast")
)

var (
	zeroTime = time.Time{}
)

type pool interface {
	Get() (*conn, bool, error)
	Put(*conn) error
	Remove(*conn) error
	Len() int
	Size() int
	Close() error
	Filter(func(*conn) bool)
}

//------------------------------------------------------------------------------

type conn struct {
	netcn net.Conn
	rd    *bufio.Reader
	buf   []byte

	inUse  bool
	usedAt time.Time

	readTimeout  time.Duration
	writeTimeout time.Duration

	elem *list.Element
}

func newConnFunc(dial func() (net.Conn, error)) func() (*conn, error) {
	return func() (*conn, error) {
		netcn, err := dial()
		if err != nil {
			return nil, err
		}
		cn := &conn{
			netcn: netcn,
			buf:   make([]byte, 0, 64),
		}
		cn.rd = bufio.NewReader(cn)
		return cn, nil
	}
}

func (cn *conn) Read(b []byte) (int, error) {
	if cn.readTimeout != 0 {
		cn.netcn.SetReadDeadline(time.Now().Add(cn.readTimeout))
	} else {
		cn.netcn.SetReadDeadline(zeroTime)
	}
	return cn.netcn.Read(b)
}

func (cn *conn) Write(b []byte) (int, error) {
	if cn.writeTimeout != 0 {
		cn.netcn.SetWriteDeadline(time.Now().Add(cn.writeTimeout))
	} else {
		cn.netcn.SetWriteDeadline(zeroTime)
	}
	return cn.netcn.Write(b)
}

func (cn *conn) RemoteAddr() net.Addr {
	return cn.netcn.RemoteAddr()
}

func (cn *conn) Close() error {
	return cn.netcn.Close()
}

//------------------------------------------------------------------------------

type connPool struct {
	dial func() (*conn, error)
	rl   *rateLimiter

	opt *options

	cond  *sync.Cond
	conns *list.List

	idleNum int
	closed  bool
}

func newConnPool(dial func() (*conn, error), opt *options) *connPool {
	return &connPool{
		dial: dial,
		rl:   newRateLimiter(time.Second, 2*opt.PoolSize),

		opt: opt,

		cond:  sync.NewCond(&sync.Mutex{}),
		conns: list.New(),
	}
}

func (p *connPool) new() (*conn, error) {
	if !p.rl.Check() {
		return nil, errRateLimited
	}
	return p.dial()
}

func (p *connPool) Get() (*conn, bool, error) {
	p.cond.L.Lock()

	if p.closed {
		p.cond.L.Unlock()
		return nil, false, errClosed
	}

	if p.opt.IdleTimeout > 0 {
		for el := p.conns.Front(); el != nil; el = el.Next() {
			cn := el.Value.(*conn)
			if cn.inUse {
				break
			}
			if time.Since(cn.usedAt) > p.opt.IdleTimeout {
				if err := p.remove(cn); err != nil {
					log.Printf("remove failed: %s", err)
				}
			}
		}
	}

	for p.conns.Len() >= p.opt.PoolSize && p.idleNum == 0 {
		p.cond.Wait()
	}

	if p.idleNum > 0 {
		elem := p.conns.Front()
		cn := elem.Value.(*conn)
		if cn.inUse {
			panic("pool: precondition failed")
		}
		cn.inUse = true
		p.conns.MoveToBack(elem)
		p.idleNum--

		p.cond.L.Unlock()
		return cn, false, nil
	}

	if p.conns.Len() < p.opt.PoolSize {
		cn, err := p.new()
		if err != nil {
			p.cond.L.Unlock()
			return nil, false, err
		}

		cn.inUse = true
		cn.elem = p.conns.PushBack(cn)

		p.cond.L.Unlock()
		return cn, true, nil
	}

	panic("not reached")
}

func (p *connPool) Put(cn *conn) error {
	if cn.rd.Buffered() != 0 {
		b, _ := cn.rd.ReadN(cn.rd.Buffered())
		log.Printf("redis: connection has unread data: %q", b)
		return p.Remove(cn)
	}

	if p.opt.IdleTimeout > 0 {
		cn.usedAt = time.Now()
	}

	p.cond.L.Lock()
	if p.closed {
		p.cond.L.Unlock()
		return errClosed
	}
	cn.inUse = false
	p.conns.MoveToFront(cn.elem)
	p.idleNum++
	p.cond.Signal()
	p.cond.L.Unlock()

	return nil
}

func (p *connPool) Remove(cn *conn) error {
	p.cond.L.Lock()
	if p.closed {
		// Noop, connection is already closed.
		p.cond.L.Unlock()
		return nil
	}
	err := p.remove(cn)
	p.cond.Signal()
	p.cond.L.Unlock()
	return err
}

func (p *connPool) remove(cn *conn) error {
	p.conns.Remove(cn.elem)
	cn.elem = nil
	if !cn.inUse {
		p.idleNum--
	}
	return cn.Close()
}

// Len returns number of idle connections.
func (p *connPool) Len() int {
	defer p.cond.L.Unlock()
	p.cond.L.Lock()
	return p.idleNum
}

// Size returns number of connections in the pool.
func (p *connPool) Size() int {
	defer p.cond.L.Unlock()
	p.cond.L.Lock()
	return p.conns.Len()
}

func (p *connPool) Filter(f func(*conn) bool) {
	p.cond.L.Lock()
	for el, next := p.conns.Front(), p.conns.Front(); el != nil; el = next {
		next = el.Next()
		cn := el.Value.(*conn)
		if !f(cn) {
			p.remove(cn)
		}
	}
	p.cond.L.Unlock()
}

func (p *connPool) Close() error {
	defer p.cond.L.Unlock()
	p.cond.L.Lock()
	if p.closed {
		return nil
	}
	p.closed = true
	p.rl.Close()
	var retErr error
	for {
		e := p.conns.Front()
		if e == nil {
			break
		}
		if err := p.remove(e.Value.(*conn)); err != nil {
			log.Printf("cn.Close failed: %s", err)
			retErr = err
		}
	}
	return retErr
}

//------------------------------------------------------------------------------

type singleConnPool struct {
	pool pool

	cnMtx sync.Mutex
	cn    *conn

	reusable bool

	closed bool
}

func newSingleConnPool(pool pool, reusable bool) *singleConnPool {
	return &singleConnPool{
		pool:     pool,
		reusable: reusable,
	}
}

func (p *singleConnPool) SetConn(cn *conn) {
	p.cnMtx.Lock()
	p.cn = cn
	p.cnMtx.Unlock()
}

func (p *singleConnPool) Get() (*conn, bool, error) {
	defer p.cnMtx.Unlock()
	p.cnMtx.Lock()

	if p.closed {
		return nil, false, errClosed
	}
	if p.cn != nil {
		return p.cn, false, nil
	}

	cn, isNew, err := p.pool.Get()
	if err != nil {
		return nil, false, err
	}
	p.cn = cn

	return p.cn, isNew, nil
}

func (p *singleConnPool) Put(cn *conn) error {
	defer p.cnMtx.Unlock()
	p.cnMtx.Lock()
	if p.cn != cn {
		panic("p.cn != cn")
	}
	if p.closed {
		return errClosed
	}
	return nil
}

func (p *singleConnPool) put() error {
	err := p.pool.Put(p.cn)
	p.cn = nil
	return err
}

func (p *singleConnPool) Remove(cn *conn) error {
	defer p.cnMtx.Unlock()
	p.cnMtx.Lock()
	if p.cn == nil {
		panic("p.cn == nil")
	}
	if p.cn != cn {
		panic("p.cn != cn")
	}
	if p.closed {
		return errClosed
	}
	return p.remove()
}

func (p *singleConnPool) remove() error {
	err := p.pool.Remove(p.cn)
	p.cn = nil
	return err
}

func (p *singleConnPool) Len() int {
	defer p.cnMtx.Unlock()
	p.cnMtx.Lock()
	if p.cn == nil {
		return 0
	}
	return 1
}

func (p *singleConnPool) Size() int {
	defer p.cnMtx.Unlock()
	p.cnMtx.Lock()
	if p.cn == nil {
		return 0
	}
	return 1
}

func (p *singleConnPool) Filter(f func(*conn) bool) {
	p.cnMtx.Lock()
	if p.cn != nil {
		if !f(p.cn) {
			p.remove()
		}
	}
	p.cnMtx.Unlock()
}

func (p *singleConnPool) Close() error {
	defer p.cnMtx.Unlock()
	p.cnMtx.Lock()
	if p.closed {
		return nil
	}
	p.closed = true
	var err error
	if p.cn != nil {
		if p.reusable {
			err = p.put()
		} else {
			err = p.remove()
		}
	}
	return err
}
