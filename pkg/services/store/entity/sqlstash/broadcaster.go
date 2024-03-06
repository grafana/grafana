package sqlstash

import (
	"context"
	"fmt"
)

type ConnectFunc[T any] func(chan T) error

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

	return sub, nil
}

func (b *broadcaster[T]) Unsubscribe(sub chan T) {
	b.unsubscribe <- sub
}

func (b *broadcaster[T]) start(ctx context.Context, connect ConnectFunc[T]) error {
	if b.running {
		return fmt.Errorf("broadcaster already running")
	}

	stream := make(chan T, 100)

	err := connect(stream)
	if err != nil {
		return err
	}

	b.ctx = ctx

	b.cache = NewCache[T](ctx, 100)
	b.subscribe = make(chan chan T, 100)
	b.unsubscribe = make(chan chan T, 100)
	b.subs = make(map[chan T]struct{})

	go b.stream(stream)

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
			// send initial batch of cached items
			err := b.cache.ReadInto(sub)
			if err != nil {
				close(sub)
				continue
			}

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
	ReadInto(dst chan T) error
}

type cache[T any] struct {
	cache     []T
	size      int
	cacheZero int
	cacheLen  int
	add       chan T
	read      chan chan T
	ctx       context.Context
}

func NewCache[T any](ctx context.Context, size int) Cache[T] {
	c := &cache[T]{}

	c.ctx = ctx
	if size <= 0 {
		size = DefaultCacheSize
	}
	c.size = size
	c.cache = make([]T, c.size)

	c.add = make(chan T)
	c.read = make(chan chan T)

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
		read:
			for i := 0; i < c.cacheLen; i++ {
				select {
				case r <- c.cache[(c.cacheZero+i)%len(c.cache)]:
				// don't wait for slow consumers
				default:
					break read
				}
			}
			close(r)
		}
	}
}

func (c *cache[T]) Get(i int) T {
	r := make(chan T, c.size)
	c.read <- r
	idx := 0
	for item := range r {
		if idx == i {
			return item
		}
		idx++
	}
	var zero T
	return zero
}

func (c *cache[T]) Range(f func(T) error) error {
	r := make(chan T, c.size)
	c.read <- r
	for item := range r {
		err := f(item)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *cache[T]) Slice() []T {
	s := make([]T, 0, c.size)
	r := make(chan T, c.size)
	c.read <- r
	for item := range r {
		s = append(s, item)
	}
	return s
}

func (c *cache[T]) ReadInto(dst chan T) error {
	r := make(chan T, c.size)
	c.read <- r
	for item := range r {
		select {
		case dst <- item:
		default:
			return fmt.Errorf("slow consumer")
		}
	}
	return nil
}
