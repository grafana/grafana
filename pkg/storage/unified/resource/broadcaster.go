package resource

import (
	"context"
	"fmt"
	"io"
)

// Please, when reviewing or working on this file have the following cheat-sheet
// in mind:
//	1. A channel type in Go has one of three directions: send-only (chan<- T),
//	   receive-only (<-chan T) or bidirctional (chan T). Each of them are a
//	   different type. A bidirectional type can be converted to any of the other
//	   two types and is automatic, any other conversion attempt results in a
//	   panic.
//	2. There are three operations you can do on a channel: send, receive and
//	   close. Availability of operation for each channel direction:
//		          |            Channel direction
//		Operation | Receive-only | Send-only  | Bidirectional
//		----------+--------------+------------+--------------
//		Receive   | Yes          | No (panic) | Yes
//		Send      | No (panic)   | Yes        | Yes
//		Close     | No (panic)   | Yes        | Yes
//	3. A channel of any type also has one of three states: nil (zero value),
//	   closed, or open (technically called "non-nil, not-closed channel",
//	   created with the `make` builtin). Nil and closed channels are also
//	   useful, but you have to know and care for how you use them. Outcome of
//	   each operation on a channel depending on its state, assuming the
//	   operation is available to the channel given its direction:
//		          |                 Channel state
//		Operation | Nil           | Closed        | Open
//		----------+---------------+---------------+------------------
//		Receive   | Block forever | Block forever | Receive/Block until receive
//		Send      | Block forever | Panic         | Send/Block until send
//		Close     | Panic         | Panic         | Close the channel
//	4. A `select` statement has zero or more `case` branches, each one of them
//	   containing either a send or a receive channel operation. A `select` with
//	   no branches blocks forever. At most one branch will be executed, which
//	   means it behaves similar to a `switch`. If more than one branch can be
//	   executed then one of them is picked AT RANDOM (i.e. not the one first in
//	   the list). A `select` statement can also have a (single and optional)
//	   `default` branch that is executed if all the other branches are
//	   operations that are blocked at the time the `select` statement is
//	   reached. This means that having a `default` branch causes the `select`
//	   statement to never block.
//	5. A receive operation on a closed channel never blocks (as said before),
//	   but it will always yield a zero value. As it is also valid to send a zero
//	   value to the channel, you can receive from channels in two forms:
//		v := <-c // get a zero value if closed
//		v2, ok := <-c // `ok` is set to false iif the channel is closed
//	6. The `make` builtin is used to create open channels (and is the only way
//	   to get them). It has an optional second parameter to specify the amount
//	   of items that can buffered. After that, a send operation will block
//	   waiting for another goroutine to receive from it (which would make room
//	   for the new item). When the second argument is not passed to `make`, then
//	   all operations are fully synchronized, meaning that a send will block
//	   until a receive in another goroutine is performed, and vice versa. Less
//	   interestingly, `make` can also create send-only or receive-only channel.
//
// The sources are the Go Specs, Effective Go and Go 101, which are already
// linked in the contributing guide for the backend or elsewhere in Grafana, but
// this file exploits so many of these subtleties that it's worth keeping a
// refresher about them at all times. The above is unlikely to change in the
// foreseeable future, so it's zero maintenance as well. We exclude patterns for
// using channels and other concurrency patterns since that's a way longer
// topic for a refresher.

// ConnectFunc is used to initialize the watch implementation. It should do very
// basic work and checks and it has the chance to return an error. After that,
// it should fork to a different goroutine with the provided channel and send to
// it all the new events from the backing database. It is also responsible for
// closing the provided channel under all circumstances, included returning an
// error. The caller of this function will only receive from this channel (i.e.
// it is guaranteed to never send to it or close it), hence providing a safe
// separation of concerns and preventing panics.
//
// FIXME: this signature suffers from inversion of control. It would also be
// much simpler if NewBroadcaster receives a context.Context and a <-chan T
// instead. That would also reduce the scope of the broadcaster to only
// broadcast to subscribers what it receives on the provided <-chan T. The
// context.Context is still needed to provide additional values in case we want
// to add observability into the broadcaster, which we want. The broadcaster
// should still terminate on either the context being done or the provided
// channel being closed.
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
	// lifecycle management

	started, terminated chan struct{}
	shouldTerminate     <-chan struct{}

	// subscription management

	cache       channelCache[T]
	subscribe   chan chan T
	unsubscribe chan (<-chan T)
	subs        map[<-chan T]chan T
}

func (b *broadcaster[T]) Subscribe(ctx context.Context) (<-chan T, error) {
	select {
	case <-ctx.Done(): // client canceled
		return nil, ctx.Err()
	case <-b.started: // wait for broadcaster to start
	}

	// create the subscription
	sub := make(chan T, 100)

	select {
	case <-ctx.Done(): // client canceled
		return nil, ctx.Err()
	case <-b.terminated: // no more data
		return nil, io.EOF
	case b.subscribe <- sub: // success submitting subscription
		return sub, nil
	}
}

func (b *broadcaster[T]) Unsubscribe(sub <-chan T) {
	// wait for broadcaster to start. In practice, the only way to reach
	// Unsubscribe is by first having called Subscribe, which means we have
	// already started. But a malfunctioning caller may call Unsubscribe freely,
	// which would cause us to block forever the goroutine of the caller when
	// trying to send to a nil `b.unsubscribe` or receive from a nil
	// `b.terminated` if we haven't yet initialized those values. This would
	// mean leaking that malfunctioninig caller's goroutine, so we rather make
	// Unsubscribe safe in any possible case
	if sub == nil {
		return
	}
	<-b.started // wait for broadcaster to start

	select {
	case b.unsubscribe <- sub: // success submitting unsubscription
	case <-b.terminated: // broadcaster terminated, nothing to do
	}
}

// init initializes the broadcaster. It should not be run more than once.
func (b *broadcaster[T]) init(ctx context.Context, connect ConnectFunc[T]) error {
	// create the stream that will connect us with the watch implementation and
	// send it to them so they initialize and start sending data
	stream := make(chan T, 100)
	if err := connect(stream); err != nil {
		return err
	}

	// initialize our internal state
	b.shouldTerminate = ctx.Done()
	b.cache = newChannelCache[T](ctx, 100)
	b.subscribe = make(chan chan T, 100)
	b.unsubscribe = make(chan (<-chan T), 100)
	b.subs = make(map[<-chan T]chan T)
	b.terminated = make(chan struct{})

	// start handling incoming data from the watch implementation. If data came
	// in until now, it will be buffered in `stream`
	go b.stream(stream)

	// unblock any Subscribe/Unsubscribe calls since we are ready to handle them
	close(b.started)

	return nil
}

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
		// terminate all subscirptions and clean the map
		for _, sub := range b.subs {
			close(sub)
			delete(b.subs, sub)
		}
	}()

	for {
		select {
		case <-b.shouldTerminate: // service context cancelled
			return

		case sub := <-b.subscribe: // subscribe
			// send initial batch of cached items
			err := b.cache.ReadInto(sub)
			if err != nil {
				close(sub)
				continue
			}
			b.subs[sub] = sub

		case recv := <-b.unsubscribe: // unsubscribe
			if sub, ok := b.subs[recv]; ok {
				close(sub)
				delete(b.subs, sub)
			}

		case item, ok := <-input: // data arrived, send to subscribers
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

const defaultCacheSize = 100

type channelCache[T any] interface {
	Len() int
	Add(item T)
	Get(i int) T
	Range(f func(T) error) error
	Slice() []T
	ReadInto(dst chan T) error
}

type localCache[T any] struct {
	cache     []T
	size      int
	cacheZero int
	cacheLen  int
	add       chan T
	read      chan chan T
	ctx       context.Context
}

func newChannelCache[T any](ctx context.Context, size int) channelCache[T] {
	c := &localCache[T]{}

	c.ctx = ctx
	if size <= 0 {
		size = defaultCacheSize
	}
	c.size = size
	c.cache = make([]T, c.size)

	c.add = make(chan T)
	c.read = make(chan chan T)

	go c.run()

	return c
}

func (c *localCache[T]) Len() int {
	return c.cacheLen
}

func (c *localCache[T]) Add(item T) {
	c.add <- item
}

func (c *localCache[T]) run() {
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

func (c *localCache[T]) Get(i int) T {
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

func (c *localCache[T]) Range(f func(T) error) error {
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

func (c *localCache[T]) Slice() []T {
	s := make([]T, 0, c.size)
	r := make(chan T, c.size)
	c.read <- r
	for item := range r {
		s = append(s, item)
	}
	return s
}

func (c *localCache[T]) ReadInto(dst chan T) error {
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
