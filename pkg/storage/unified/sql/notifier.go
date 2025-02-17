package sql

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type eventNotifier interface {
	notify(ctx context.Context) (<-chan *resource.WrittenEvent, error)
	send(ctx context.Context, event *resource.WrittenEvent)
	close()
}

type channelNotifier struct {
	events chan *resource.WrittenEvent
	log    log.Logger
}

func newNotifier(b *backend, bufferSize int, pollingInterval time.Duration, log log.Logger) eventNotifier {
	if b.dialect.DialectName() == "sqlite" {
		log.Debug("Using channel notifier")
		return newChannelNotifier(bufferSize, log)
	}
	log.Debug("Using polling notifier")
	return newPollingNotifier(b, pollingInterval)
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
