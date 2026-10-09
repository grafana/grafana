package service

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type Workers struct {
	worker resource.BroadcasterConsumer
	cancel context.CancelFunc
	wg     sync.WaitGroup
	log    log.Logger
}

func NewWorkers(worker resource.BroadcasterConsumer) *Workers {
	return &Workers{worker: worker, log: log.New("resource-server")}
}

func (w *Workers) Start(events resource.Broadcaster[*resource.WrittenEvent]) {
	if w.worker == nil {
		return
	}
	if events != nil {
		w.worker.UseBroadcaster(events)
	}
	ctx, cancel := context.WithCancel(context.Background())
	w.cancel = cancel
	w.wg.Go(func() {
		if err := w.worker.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
			w.log.Error("vector reconciler stopped", "err", err)
		}
	})
}

func (w *Workers) Stop(ctx context.Context) {
	if w.cancel != nil {
		w.cancel()
	}
	done := make(chan struct{})
	go func() { w.wg.Wait(); close(done) }()
	select {
	case <-done:
		w.log.Debug("vector indexers stopped")
	case <-ctx.Done():
		w.log.Warn("timed out waiting for vector indexers to stop")
	}
}
