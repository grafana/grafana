package sql

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type eventNotifier interface {
	notify(ctx context.Context) (<-chan *resource.WrittenEvent, error)
	// send will forward an event to all subscribers who want to be notified.
	//
	// Note: depending on the implementation, send might be noop and new events
	//       will be fetched from an external source.
	send(ctx context.Context, event *resource.WrittenEvent)
	close()
}

func newNotifier(b *backend) (eventNotifier, error) {
	if b.isHA {
		b.log.Info("Using polling notifier")
		notifier, err := newPollingNotifier(&pollingNotifierConfig{
			pollingInterval: b.pollingInterval,
			watchBufferSize: b.watchBufferSize,
			log:             b.log,
			tracer:          b.tracer,
			bulkLock:        b.bulkLock,
			listLatestRVs:   b.listLatestRVs,
			storageMetrics:  b.storageMetrics,
			historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
				var records []*historyPollResponse
				err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
					var err error
					records, err = dbutil.Query(ctx, tx, sqlResourceHistoryPoll, &sqlResourceHistoryPollRequest{
						SQLTemplate:          sqltemplate.New(b.dialect),
						Resource:             res,
						Group:                grp,
						SinceResourceVersion: since,
						Response:             &historyPollResponse{},
					})
					return err
				})
				return records, err
			},
			done:    b.done,
			dialect: b.dialect,
		})
		if err != nil {
			return nil, err
		}
		return notifier, nil
	}

	b.log.Info("Using channel notifier")
	return newChannelNotifier(b.watchBufferSize, b.log), nil
}

type channelNotifier struct {
	log        log.Logger
	bufferSize int

	mu          sync.RWMutex
	subscribers map[chan *resource.WrittenEvent]bool
}

func newChannelNotifier(bufferSize int, log log.Logger) *channelNotifier {
	return &channelNotifier{
		subscribers: make(map[chan *resource.WrittenEvent]bool),
		log:         log,
		bufferSize:  bufferSize,
	}
}

func (n *channelNotifier) notify(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	events := make(chan *resource.WrittenEvent, n.bufferSize)

	n.mu.Lock()
	n.subscribers[events] = true
	n.mu.Unlock()

	go func() {
		<-ctx.Done()
		n.mu.Lock()
		if n.subscribers[events] {
			delete(n.subscribers, events)
			close(events)
		}
		n.mu.Unlock()
	}()

	return events, nil
}

func (n *channelNotifier) send(_ context.Context, event *resource.WrittenEvent) {
	n.mu.RLock()
	defer n.mu.RUnlock()

	for ch := range n.subscribers {
		select {
		case ch <- event:
		default:
			n.log.Warn("Dropped event notification for subscriber - channel full")
		}
	}
}

func (n *channelNotifier) close() {
	n.mu.Lock()
	defer n.mu.Unlock()

	for ch := range n.subscribers {
		close(ch)
	}
	n.subscribers = make(map[chan *resource.WrittenEvent]bool)
}
