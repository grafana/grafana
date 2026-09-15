package resource

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

type fakeWrittenEventConsumer struct {
	events  <-chan *WrittenEvent
	started chan struct{}
}

func (c *fakeWrittenEventConsumer) UseWrittenEvents(events <-chan *WrittenEvent) {
	c.events = events
}

func (c *fakeWrittenEventConsumer) Run(ctx context.Context) error {
	close(c.started)
	<-ctx.Done()
	return ctx.Err()
}

type fakeIndexerBroadcaster struct {
	events         chan *WrittenEvent
	subscribeErr   error
	subscribeCalls chan struct{}
	unsubscribed   chan (<-chan *WrittenEvent)
}

func (b *fakeIndexerBroadcaster) Subscribe(context.Context, string, string) (<-chan *WrittenEvent, error) {
	b.subscribeCalls <- struct{}{}
	if b.subscribeErr != nil {
		return nil, b.subscribeErr
	}
	return b.events, nil
}

func (b *fakeIndexerBroadcaster) Unsubscribe(events <-chan *WrittenEvent) {
	b.unsubscribed <- events
}

func TestStartVectorIndexersOwnsWrittenEventSubscription(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	consumer := &fakeWrittenEventConsumer{started: make(chan struct{})}
	broadcaster := &fakeIndexerBroadcaster{
		events:         make(chan *WrittenEvent),
		subscribeCalls: make(chan struct{}, 1),
		unsubscribed:   make(chan (<-chan *WrittenEvent), 1),
	}
	srv := &server{
		ctx:                   ctx,
		log:                   log.NewNopLogger(),
		broadcaster:           broadcaster,
		vectorWriteReconciler: consumer,
	}

	srv.startVectorIndexers()
	select {
	case <-consumer.started:
	case <-time.After(time.Second):
		t.Fatal("vector reconciler did not start")
	}
	require.Equal(t, (<-chan *WrittenEvent)(broadcaster.events), consumer.events)

	cancel()
	stopped := make(chan struct{})
	go func() {
		srv.indexersWG.Wait()
		close(stopped)
	}()
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("vector reconciler did not stop")
	}
	select {
	case events := <-broadcaster.unsubscribed:
		require.Equal(t, consumer.events, events)
	default:
		t.Fatal("server did not unsubscribe the vector reconciler")
	}
}

func TestStartVectorIndexersContinuesWithoutWrittenEventSubscription(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	consumer := &fakeWrittenEventConsumer{started: make(chan struct{})}
	broadcaster := &fakeIndexerBroadcaster{
		events:         make(chan *WrittenEvent),
		subscribeErr:   errors.New("subscribe failed"),
		subscribeCalls: make(chan struct{}, 1),
		unsubscribed:   make(chan (<-chan *WrittenEvent), 1),
	}
	srv := &server{
		ctx:                   ctx,
		log:                   log.NewNopLogger(),
		broadcaster:           broadcaster,
		vectorWriteReconciler: consumer,
	}

	srv.startVectorIndexers()
	select {
	case <-consumer.started:
	case <-time.After(time.Second):
		t.Fatal("vector reconciler did not start after subscription failure")
	}
	require.Nil(t, consumer.events)

	cancel()
	srv.indexersWG.Wait()
	select {
	case <-broadcaster.unsubscribed:
		t.Fatal("failed subscription was unsubscribed")
	default:
	}
}
