package sqlstash

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

type ConnectFunc func() (chan *entity.Entity, error)

type Broadcaster struct {
	sync.Mutex
	running bool
	subs    map[chan *entity.Entity]struct{}
}

func (b *Broadcaster) Subscribe(ctx context.Context) (<-chan *entity.Entity, error) {
	b.Lock()
	defer b.Unlock()

	if !b.running {
		return nil, fmt.Errorf("broadcaster not running")
	}

	sub := make(chan *entity.Entity, 100)
	if b.subs == nil {
		b.subs = map[chan *entity.Entity]struct{}{}
	}
	b.subs[sub] = struct{}{}
	go func() {
		<-ctx.Done()
		b.unsub(sub, true)
	}()

	return sub, nil
}

func (b *Broadcaster) unsub(sub chan *entity.Entity, lock bool) {
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

func (b *Broadcaster) Start(connect ConnectFunc) error {
	c, err := connect()
	if err != nil {
		return err
	}

	go b.stream(c)
	b.running = true
	return nil
}

func (b *Broadcaster) stream(input chan *entity.Entity) {
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
