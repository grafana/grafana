package resource

import (
	"context"
	"io"
	"log/slog"
)

type Broadcaster[T any] interface {
	Subscribe(ctx context.Context, name string) (<-chan T, error)
	Unsubscribe(<-chan T)
}

// NewBroadcaster creates a broadcaster that fans out items received on input to
// all active subscribers. The caller owns the input channel and is responsible
// for closing it when no more data will be sent. The broadcaster terminates
// when either ctx is cancelled or input is closed.
func NewBroadcaster[T any](ctx context.Context, input <-chan T) Broadcaster[T] {
	b := &broadcaster[T]{
		shouldTerminate: ctx.Done(),
		cache:           newRingBuffer[T](100),
		subscribe:       make(chan subscription[T], chanBufferLen),
		unsubscribe:     make(chan (<-chan T), chanBufferLen),
		subs:            make(map[<-chan T]subscription[T]),
		terminated:      make(chan struct{}),
	}

	go b.stream(input)

	return b
}

type subscription[T any] struct {
	name string
	ch   chan T
}

type broadcaster[T any] struct {
	// lifecycle management

	terminated      chan struct{}
	shouldTerminate <-chan struct{}

	// subscription management

	cache       ringBuffer[T]
	subscribe   chan subscription[T]
	unsubscribe chan (<-chan T)
	subs        map[<-chan T]subscription[T]
}

func (b *broadcaster[T]) Subscribe(ctx context.Context, name string) (<-chan T, error) {
	sub := subscription[T]{name: name, ch: make(chan T, 100)}

	select {
	case <-ctx.Done(): // client canceled
		return nil, ctx.Err()
	case <-b.terminated: // no more data
		return nil, io.EOF
	case b.subscribe <- sub: // success submitting subscription
		return sub.ch, nil
	}
}

func (b *broadcaster[T]) Unsubscribe(sub <-chan T) {
	if sub == nil {
		return
	}

	select {
	case b.unsubscribe <- sub: // success submitting unsubscription
	case <-b.terminated: // broadcaster terminated, nothing to do
	}
}

const chanBufferLen = 100

// stream acts a message broker between the watch implementation that receives a
// raw stream of events and the individual clients watching for those events.
// Thus, we hold the receive side of the watch implementation, and we are
// limited here to receive from it, whereas we are responsible for sending to
// watchers and closing their channels. The responsibility of closing `input`
// (as with any other channel) will always be of the sending side. Hence, the
// watch implementation should do it.
func (b *broadcaster[T]) stream(input <-chan T) {
	// make sure we unconditionally cleanup upon return
	defer func() {
		// prevent new subscriptions and make sure to discard unsubscriptions
		close(b.terminated)
		// terminate all subscriptions
		for recv, sub := range b.subs {
			close(sub.ch)
			delete(b.subs, recv)
		}
	}()

	unsubscribe := func(recv <-chan T) {
		if sub, ok := b.subs[recv]; ok {
			close(sub.ch)
			delete(b.subs, recv)
		}
	}

	addSubscriber := func(sub subscription[T]) {
		if !b.cache.readInto(sub.ch) {
			close(sub.ch)
			return
		}
		b.subs[sub.ch] = sub
	}

	for {
		select {
		case <-b.shouldTerminate: // service context cancelled
			return

		case sub := <-b.subscribe: // subscribe
			addSubscriber(sub)

		case recv := <-b.unsubscribe: // unsubscribe
			// Drain pending subscribes first. A caller does Subscribe then
			// Unsubscribe sequentially, so the subscribe message is always
			// buffered before the unsubscribe. Without this drain, select
			// may pick the unsubscribe first, making it a no-op and
			// leaving the subscriber channel unclosed.
			for drained := false; !drained; {
				select {
				case sub := <-b.subscribe:
					addSubscriber(sub)
				default:
					drained = true
				}
			}
			unsubscribe(recv)

		case item, ok := <-input: // data arrived, send to subscribers
			// input closed, drain subscribers and exit
			if !ok {
				return
			}
			b.cache.add(item)

			var slow []<-chan T
			for _, sub := range b.subs {
				select {
				case sub.ch <- item:
				default:
					slow = append(slow, sub.ch)
				}
			}
			// Instead of sending subscribers to b.unsubscribe channel, we unsubscribe directly.
			// Sending to b.unsubscribe could lead to deadlock, if there are too many elements in the
			// channel buffer already.
			for _, recv := range slow {
				if sub, ok := b.subs[recv]; ok {
					slog.Warn("unsubscribing slow consumer", "subscriber", sub.name)
				}
				unsubscribe(recv)
			}
		}
	}
}

// ringBuffer is a fixed-size circular buffer. It is not safe for concurrent
// use — the broadcaster's single stream() goroutine is the only caller.
type ringBuffer[T any] struct {
	buf  []T
	zero int // index of the oldest item
	len  int // number of items currently stored
}

func newRingBuffer[T any](size int) ringBuffer[T] {
	if size <= 0 {
		size = 100
	}
	return ringBuffer[T]{
		buf: make([]T, size),
	}
}

func (r *ringBuffer[T]) add(item T) {
	i := (r.zero + r.len) % len(r.buf)
	r.buf[i] = item
	if r.len < len(r.buf) {
		r.len++
	} else {
		r.zero = (r.zero + 1) % len(r.buf)
	}
}

// readInto sends all cached items to dst without blocking. Returns true if all
// items were sent, false if dst's buffer was full (slow consumer).
func (r *ringBuffer[T]) readInto(dst chan T) bool {
	for i := 0; i < r.len; i++ {
		select {
		case dst <- r.buf[(r.zero+i)%len(r.buf)]:
		default:
			return false
		}
	}
	return true
}
