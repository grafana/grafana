package resource

import "context"

type watchStartup struct {
	stopped     chan struct{}
	broadcaster *broadcaster[*WrittenEvent]
}

func (s *server) initSeededWatcher(backend seededWatchBackend) {
	out := make(chan *WrittenEvent, producerChanSize)
	startup := &watchStartup{stopped: make(chan struct{})}
	var metrics *BroadcasterMetrics
	if s.storageMetrics != nil {
		metrics = s.storageMetrics.Broadcaster
	}

	initialize := func(ctx context.Context) (cacheSeed[*WrittenEvent], error) {
		seed, events, err := backend.watchWriteEventsWithSeed(ctx)
		if err != nil {
			close(out)
			close(startup.stopped)
			s.log.Error("failed to initialize watch cache", "error", err)
			return cacheSeed[*WrittenEvent]{}, err
		}
		s.mostRecentRV.Store(seed.highestRV)
		go func() {
			defer close(startup.stopped)
			defer close(out)
			defer func() {
				for range events {
				}
			}()
			for {
				select {
				case <-ctx.Done():
					return
				case event, ok := <-events:
					if !ok {
						return
					}
					if event == nil || event.PreviousRV < 0 {
						continue
					}
					s.mostRecentRV.Store(event.ResourceVersion)
					select {
					case out <- event:
					case <-ctx.Done():
						return
					}
				}
			}
		}()
		return cacheSeed[*WrittenEvent]{
			items: seed.events, initialCacheFloor: seed.initialCacheFloor,
			highestRV: seed.highestRV, identity: writtenEventIdentity,
		}, nil
	}

	// Construction stays asynchronous even if NATS has not entered Run yet.
	b := newBroadcasterWithSizes(s.ctx, out, watchChanSize, defaultOverflowCap, metrics, func(e *WrittenEvent) string {
		return e.Key.Resource
	}, initialize)
	startup.broadcaster = b
	s.broadcaster, s.watchStartup = b, startup
}
