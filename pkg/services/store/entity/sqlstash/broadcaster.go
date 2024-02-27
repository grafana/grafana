package sqlstash

import (
	"context"
	"fmt"
)

type ConnectFunc[T any] func() (chan T, error)

type Broadcaster[T any] interface {
	Subscribe(context.Context) (<-chan T, error)
	Unsubscribe(chan T)
}

func NewBroadcaster[T any](ctx context.Context, connect ConnectFunc[T]) (Broadcaster[T], error) {
	b := &broadcaster[T]{}
	err := b.start(ctx, connect)
	if err != nil {
		return nil, err
	}

	return b, nil
}

type broadcaster[T any] struct {
	running     bool
	ctx         context.Context
	subs        map[chan T]struct{}
	cache       Cache[T]
	subscribe   chan chan T
	unsubscribe chan chan T
}

func (b *broadcaster[T]) Subscribe(ctx context.Context) (<-chan T, error) {
	if !b.running {
		return nil, fmt.Errorf("broadcaster not running")
	}

	sub := make(chan T, 100)
	b.subscribe <- sub
	go func() {
		<-ctx.Done()
		b.unsubscribe <- sub
	}()

	// send initial batch of cached items
	err := b.cache.Range(func(item T) error {
		sub <- item
		return nil
	})
	if err != nil {
		return nil, err
	}

	return sub, nil
}

func (b *broadcaster[T]) Unsubscribe(sub chan T) {
	b.unsubscribe <- sub
}

func (b *broadcaster[T]) start(ctx context.Context, connect ConnectFunc[T]) error {
	if b.running {
		return fmt.Errorf("broadcaster already running")
	}

	c, err := connect()
	if err != nil {
		return err
	}

	b.ctx = ctx

	b.cache = NewCache[T](ctx, 100)
	b.subscribe = make(chan chan T, 100)
	b.unsubscribe = make(chan chan T, 100)
	b.subs = make(map[chan T]struct{})

	go b.stream(c)

	b.running = true
	return nil
}

func (b *broadcaster[T]) stream(input chan T) {
	for {
		select {
		// context cancelled
		case <-b.ctx.Done():
			close(input)
			for sub := range b.subs {
				close(sub)
				delete(b.subs, sub)
			}
			b.running = false
			return
		// new subscriber
		case sub := <-b.subscribe:
			b.subs[sub] = struct{}{}
		// unsubscribe
		case sub := <-b.unsubscribe:
			if _, ok := b.subs[sub]; ok {
				close(sub)
				delete(b.subs, sub)
			}
		// read item from input
		case item, ok := <-input:
			// input closed, drain subscribers and exit
			if !ok {
				for sub := range b.subs {
					close(sub)
					delete(b.subs, sub)
				}
				b.running = false
				return
			}

			b.cache.Add(item)

			for sub := range b.subs {
				select {
				case sub <- item:
				default:
					// Slow consumer, drop
					b.unsubscribe <- sub
				}
			}
		}
	}
}

const DefaultCacheSize = 100

type Cache[T any] interface {
	Len() int
	Add(item T)
	Get(i int) T
	Range(f func(T) error) error
	Slice() []T
}

type cache[T any] struct {
	cache     []T
	cacheZero int
	cacheLen  int
	add       chan T
	read      chan chan []T
	ctx       context.Context
}

func NewCache[T any](ctx context.Context, size int) Cache[T] {
	c := &cache[T]{}

	c.ctx = ctx
	if size <= 0 {
		size = DefaultCacheSize
	}
	c.cache = make([]T, size)

	c.add = make(chan T, 100)
	c.read = make(chan chan []T, 100)

	go c.run()

	return c
}

func (c *cache[T]) Len() int {
	return c.cacheLen
}

func (c *cache[T]) Add(item T) {
	c.add <- item
}

func (c *cache[T]) run() {
	for {
		select {
		case <-c.ctx.Done():
			return
		case item := <-c.add:
			i := (c.cacheZero + c.cacheLen) % len(c.cache)
			c.cache[i] = item
			if c.cacheLen < len(c.cache) {
				c.cacheLen++
			} else {
				c.cacheZero = (c.cacheZero + 1) % len(c.cache)
			}
		case r := <-c.read:
			s := make([]T, c.cacheLen)
			for i := 0; i < c.cacheLen; i++ {
				s[i] = c.cache[(c.cacheZero+i)%len(c.cache)]
			}
			r <- s
		}
	}
}

func (c *cache[T]) Get(i int) T {
	s := c.Slice()
	if i < 0 || i >= len(s) {
		var zero T
		return zero
	}
	return s[i]
}

func (c *cache[T]) Range(f func(T) error) error {
	for _, i := range c.Slice() {
		err := f(i)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *cache[T]) Slice() []T {
	r := make(chan []T)
	c.read <- r
	s := <-r
	return s
}
