package sql

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type eventNotifier interface {
	notify(ctx context.Context) (<-chan *resource.WrittenEvent, error)
	send(ctx context.Context, event *resource.WrittenEvent)
	close()
}

func newNotifier(b *backend, bufferSize int, pollingInterval time.Duration, log log.Logger) (eventNotifier, error) {
	// TODO(JPQ): Use better HA detection.
	if b.dialect.DialectName() == sqltemplate.SQLite.DialectName() {
		log.Info("Using channel notifier")
		return newChannelNotifier(bufferSize, log), nil
	}
	log.Info("Using polling notifier")
	notifier, err := newPollingNotifier(&pollingNotifierConfig{
		pollingInterval: pollingInterval,
		watchBufferSize: bufferSize,
		log:             log,
		tracer:          b.tracer,
		batchLock:       b.batchLock,
		listLatestRVs:   b.listLatestRVs,
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
		done: b.done,
	})
	if err != nil {
		return nil, err
	}
	return notifier, nil
}

type channelNotifier struct {
	events chan *resource.WrittenEvent
	log    log.Logger
}

func newChannelNotifier(bufferSize int, log log.Logger) *channelNotifier {
	return &channelNotifier{
		events: make(chan *resource.WrittenEvent, bufferSize),
		log:    log,
	}
}

func (n *channelNotifier) notify(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	events := make(chan *resource.WrittenEvent, cap(n.events))
	go func() {
		defer close(events)
		for {
			select {
			case event := <-n.events:
				select {
				case events <- event:
				case <-ctx.Done():
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	return events, nil
}

func (n *channelNotifier) send(_ context.Context, event *resource.WrittenEvent) {
	select {
	case n.events <- event:
	default:
		n.log.Warn("Dropped event notification - channel full")
	}
}

func (n *channelNotifier) close() {
	close(n.events)
}
