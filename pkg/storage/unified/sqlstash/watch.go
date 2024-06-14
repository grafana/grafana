package sqlstash

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (s *sqlResourceStore) Watch(context.Context, *resource.WatchRequest) (chan *resource.WatchEvent, error) {
	return nil, ErrNotImplementedYet
}

func (s *sqlResourceStore) poller(stream chan *resource.WatchEvent) {
	var err error

	since := int64(0)
	interval := 1 * time.Second

	t := time.NewTicker(interval)
	defer t.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-t.C:
			since, err = s.poll(since, stream)
			if err != nil {
				s.log.Error("watch error", "err", err)
			}
			t.Reset(interval)
		}
	}
}

func (s *sqlResourceStore) poll(since int64, out chan *resource.WatchEvent) (int64, error) {
	ctx, span := s.tracer.Start(s.ctx, "storage_server.poll")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "poll"}))

	for hasmore := true; hasmore; {
		err := func() error {
			if false {
				// TODO
				out <- &resource.WatchEvent{}
			}

			// TODO, copy from entity store
			hasmore = false
			return nil
		}()
		if err != nil {
			ctxLogger.Error("poll error", "error", err)
			return since, err
		}
	}

	return since, nil
}
