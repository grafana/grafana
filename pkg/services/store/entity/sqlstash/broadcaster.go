package sqlstash

import (
	"context"
	"fmt"
	"io"
)

type ConnectFunc[T any] func(chan<- T) error

type Broadcaster[T any] interface {
	Subscribe(context.Context) (<-chan T, error)
	Unsubscribe(<-chan T)
}

func NewBroadcaster[T any](ctx context.Context, connect ConnectFunc[T]) (Broadcaster[T], error) {
	b := &broadcaster[T]{
		started: make(chan struct{}),
	}
	err := b.init(ctx, connect)
	if err != nil {
		return nil, err
	}

	return b, nil
}

type broadcaster[T any] struct {
	ctx                 context.Context
	subs                map[<-chan T]chan T
	cache               Cache[T]
	subscribe           chan chan T
	unsubscribe         chan (<-chan T)
	started, terminated chan struct{}
}

func (b *broadcaster[T]) Subscribe(ctx context.Context) (<-chan T, error) {
	// wait for broadcaster to start
	select {
	case <-b.started:
	}

	sub := make(chan T, 100)
	select {
	case <-b.terminated:
		return nil, io.EOF
	case b.subscribe <- sub:
	}
	go func() {
		<-ctx.Done()
		b.unsubscribe <- sub
	}()

	return sub, nil
}

func (b *broadcaster[T]) Unsubscribe(sub <-chan T) {
	// wait for broadcaster to start
	select {
	case <-b.started:
	}

	select {
	case b.unsubscribe <- sub:
	case <-b.terminated:
	}
}

// init initializes the broadcaster. It should not be run more than once.
func (b *broadcaster[T]) init(ctx context.Context, connect ConnectFunc[T]) error {
	stream := make(chan T, 100)

	err := connect(stream)
	if err != nil {
		return err
	}

	b.ctx = ctx

	b.cache = NewCache[T](ctx, 100)
	b.subscribe = make(chan chan T, 100)
	b.unsubscribe = make(chan (<-chan T), 100)
	b.subs = make(map[<-chan T]chan T)
	b.terminated = make(chan struct{})

	close(b.started)
	go b.stream(stream)

	return nil
}

func (b *broadcaster[T]) stream(input <-chan T) {
	defer func() {
		close(b.terminated)
		for _, sub := range b.subs {
			close(sub)
			delete(b.subs, sub)
		}
	}()

	for {
		select {
		// context cancelled
		case <-b.ctx.Done():
			return

		// new subscriber
		case sub := <-b.subscribe:
			// send initial batch of cached items
			err := b.cache.ReadInto(sub)
			if err != nil {
				close(sub)
				continue
			}
			b.subs[sub] = sub

		// unsubscribe
		case recv := <-b.unsubscribe:
			if sub, ok := b.subs[recv]; ok {
				close(sub)
				delete(b.subs, sub)
			}

		// read item from input
		case item, ok := <-input:
			// input closed, drain subscribers and exit
			if !ok {
				return
			}
			b.cache.Add(item)
			for _, sub := range b.subs {
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
