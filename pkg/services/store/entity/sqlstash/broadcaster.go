package sqlstash

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/grafana/grafana/pkg/util/ringq"
)

// startWatcherFunc is used to create the backend for a Broadcaster, and has the
// following responsibilities:
//
//	1- Run in the foreground
//	2- Feed the provided stream with events
//	3- Shutdown once the provided context is done
//	4- Close the provided stream once it has completed its shutdown
type startWatcherFunc[T any] func(context.Context, chan<- T)

type Broadcaster[T any] interface {
	Subscribe(context.Context) (<-chan T, error)
	Unsubscribe(<-chan T)
	Done() <-chan struct{}
}

func NewBroadcaster[T any](ctx context.Context, f startWatcherFunc[T]) (Broadcaster[T], error) {
	ctx, cancel := context.WithCancel(ctx)

	in, out, sr := ringq.DynChan[T](64)

	watcherDone := make(chan struct{})
	go func() {
		f(ctx, in)
		close(watcherDone)
	}()

	done := make(chan struct{})

	b := &broadcaster[T]{
		cache: NewCache[T](ctx, 100),

		subs:        make(map[outChan[T]]subscription[T]),
		subscribe:   make(chan subscription[T], 128),
		unsubscribe: make(chan outChan[T], 128),

		terminate:   cancel,
		done:        done,
		watcherDone: watcherDone,
		running:     true,

		statsReader: sr,
	}

	go b.stream(ctx, out, done)

	return b, nil
}

type broadcaster[T any] struct {
	cache Cache[T]

	// subscription control
	subs        map[outChan[T]]subscription[T]
	subscribe   chan subscription[T]
	unsubscribe chan outChan[T]

	// lifecycle
	terminate   context.CancelFunc
	done        <-chan struct{}
	watcherDone <-chan struct{}
	running     bool
	runningMu   sync.RWMutex

	// stats
	statsReader ringq.ChanStatsReader // TODO: add metrics
}

type (
	inChan[T any]  chan<- T
	outChan[T any] <-chan T

	subscription[T any] struct {
		inChan[T]
		outChan[T]
		ringq.ChanStatsReader // TODO: add metrics
	}
)

func (b *broadcaster[T]) Done() <-chan struct{} {
	return b.done
}

func (b *broadcaster[T]) Subscribe(ctx context.Context) (<-chan T, error) {
	b.runningMu.RLock()
	defer b.runningMu.RUnlock()
	if !b.running {
		return nil, fmt.Errorf("broadcaster not running")
	}

	in, out, sr := ringq.DynChanMax[T](16, 1024)
	sub := subscription[T]{
		inChan:          in,
		outChan:         out,
		ChanStatsReader: sr,
	}

	b.subscribe <- sub
	go func() {
		<-ctx.Done()
		b.Unsubscribe(out)
	}()

	return out, nil
}

func (b *broadcaster[T]) Unsubscribe(sub <-chan T) {
	b.runningMu.RLock()
	defer b.runningMu.RUnlock()
	if b.running {
		b.unsubscribe <- sub
	}
}

func (b *broadcaster[T]) stream(ctx context.Context, out <-chan T, done chan<- struct{}) {
	// b.done is independent from the context we receive because we want to
	// close it not befere we have terminated. Even after the context is done,
	// we keep running to drain and release resources.
	defer close(done)

	// NB: receiving from a nil channel blocks forever. We use this feature to
	// leave only the interesting select branches "selectable" to allow draining
	// and cleaning up while shutting down
	ctxDone := ctx.Done()

	for {
		select {
		// initiate shutdown
		case <-ctxDone:
			b.halt()
			ctxDone = nil

		// subscribe
		case sub := <-b.subscribe:
			// send initial batch of cached items
			err := b.cache.ReadInto(sub.inChan)
			if err != nil {
				close(sub.inChan)
				continue
			}

			b.subs[sub.outChan] = sub

		// unsubscribe
		case out := <-b.unsubscribe:
			if sub, ok := b.subs[out]; ok {
				close(sub.inChan)
				delete(b.subs, sub.outChan)
			}

		// read item from out
		case item, ok := <-out:
			// out closed, drain subscribers and exit
			if !ok {
				b.halt()
				<-b.watcherDone
				return
			}
			if ctxDone == nil {
				// context is done, we are now draining the leftover
				// notifications until we block receiving from <-out, and
				// waiting for the watcher implementation to terminate and
				// close that channel
				continue
			}

			b.cache.Add(item)

			for _, sub := range b.subs {
				sub.inChan <- item
			}
		}
	}
}

// halt initiates the halting process. It must only be called from within the
// loop of the `stream` method. It is idempotent.
func (b *broadcaster[T]) halt() {
	b.runningMu.Lock()
	defer b.runningMu.Unlock()
	if !b.running {
		return
	}

	// propagate context cancellation to all context-sensitive goroutines, in
	// case the context was not already canceled. This is because it is possible
	// that we terminate due to a fatal error that the watcher implementation
	// found, which leads it to close the channel connecting it to us
	b.terminate()

	// close and set to nil both subscribe and unsubscribe channels, so that the
	// `select` within loop in `stream` blocks in those branches and allows
	// releasing resources
	close(b.subscribe)
	close(b.unsubscribe)
	b.subscribe, b.unsubscribe = nil, nil

	// close the sending side of all subscribers and empty the subscribers map
	for _, sub := range b.subs {
		close(sub.inChan)
	}
	clear(b.subs)

	// set running to false to let `Subscribe` and `Unsubscribe` know we're no
	// longer accepting requests
	b.running = false
}

const DefaultCacheSize = 100

type Cache[T any] interface {
	Len() int
	Add(item T)
	Get(i int) T
	Range(f func(T) error) error
	Slice() []T
	ReadInto(dst chan<- T) error
}

type cache[T any] struct {
	cache     []T
	size      int
	cacheZero int
	cacheLen  int
	add       chan T
	read      chan chan T
	terminate <-chan struct{}
}

func NewCache[T any](ctx context.Context, size int) Cache[T] {
	c := &cache[T]{}

	c.terminate = ctx.Done()
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
		case <-c.terminate:
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

func (c *cache[T]) ReadInto(dst chan<- T) error {
	r := make(chan T, c.size)
	c.read <- r
	for item := range r {
		select {
		case dst <- item:
			log.Printf("sending item from cache: %#v", item) // TODO [DEBUG]: remove
		default:
			return fmt.Errorf("slow consumer")
		}
	}
	return nil
}
