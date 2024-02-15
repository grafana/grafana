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

	go b.stream(c)
	b.running = true
	return nil
}

func (b *Broadcaster[T]) stream(input chan T) {
	for item := range input {
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
