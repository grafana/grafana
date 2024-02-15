package sqlstash

import (
	"context"
	"fmt"
	"sync"
)

type ConnectFunc[T any] func() (chan T, error)

type Broadcaster[T any] struct {
	sync.Mutex
	running bool
	subs    map[chan T]struct{}
	cache   Cache[T]
}

func (b *Broadcaster[T]) Subscribe(ctx context.Context) (<-chan T, error) {
	b.Lock()
	defer b.Unlock()

	if !b.running {
		return nil, fmt.Errorf("broadcaster not running")
	}

	sub := make(chan T, 100)
	if b.subs == nil {
		b.subs = map[chan T]struct{}{}
	}
	b.subs[sub] = struct{}{}
	go func() {
		<-ctx.Done()
		b.unsub(sub, true)
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

func (b *Broadcaster[T]) unsub(sub chan T, lock bool) {
	if lock {
		b.Lock()
	}
	if _, ok := b.subs[sub]; ok {
		close(sub)
		delete(b.subs, sub)
	}
	if lock {
		b.Unlock()
	}
}

func (b *Broadcaster[T]) Start(connect ConnectFunc[T]) error {
	c, err := connect()
	if err != nil {
		return err
	}

	b.cache.Init(100)

	go b.stream(c)
	b.running = true
	return nil
}

func (b *Broadcaster[T]) stream(input chan T) {
	for item := range input {
		// add item to cache
		b.cache.Add(item)

		b.Lock()
		for sub := range b.subs {
			select {
			case sub <- item:
			default:
				// Slow consumer, drop
				go b.unsub(sub, true)
			}
		}
		b.Unlock()
	}

	b.Lock()
	for sub := range b.subs {
		b.unsub(sub, false)
	}
	b.running = false
	b.Unlock()
}

const DefaultCacheSize = 100

type Cache[T any] struct {
	sync.Mutex
	cache     []T
	cacheZero int
	cacheLen  int
}

func (c *Cache[T]) Init(size int) {
	c.Lock()
	defer c.Unlock()
	if size <= 0 {
		size = DefaultCacheSize
	}
	c.cache = make([]T, size)
	c.cacheZero = 0
	c.cacheLen = 0
}

func (c *Cache[T]) Len() int {
	c.Lock()
	defer c.Unlock()
	return c.cacheLen
}

func (c *Cache[T]) Add(item T) {
	c.Lock()
	defer c.Unlock()
	if c.cache == nil {
		c.cache = make([]T, DefaultCacheSize)
		c.cacheZero = 0
		c.cacheLen = 0
	}

	i := (c.cacheZero + c.cacheLen) % len(c.cache)
	c.cache[i] = item
	if c.cacheLen < len(c.cache) {
		c.cacheLen++
	} else {
		c.cacheZero = (c.cacheZero + 1) % len(c.cache)
	}
}

func (c *Cache[T]) Get(i int) T {
	c.Lock()
	defer c.Unlock()
	if i < 0 || i >= c.cacheLen {
		var zero T
		return zero
	}
	return c.cache[(c.cacheZero+i)%len(c.cache)]
}

func (c *Cache[T]) Range(f func(T) error) error {
	c.Lock()
	defer c.Unlock()
	var err error
	for i := 0; i < c.cacheLen; i++ {
		err = f(c.cache[(c.cacheZero+i)%len(c.cache)])
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *Cache[T]) Slice() []T {
	c.Lock()
	defer c.Unlock()
	s := make([]T, c.cacheLen)
	for i := 0; i < c.cacheLen; i++ {
		s[i] = c.cache[(c.cacheZero+i)%len(c.cache)]
	}
	return s
}
