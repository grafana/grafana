package sql

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type pollingNotifier struct {
	backend         *backend
	pollingInterval time.Duration
}

func newPollingNotifier(backend *backend, interval time.Duration) *pollingNotifier {
	return &pollingNotifier{
		backend:         backend,
		pollingInterval: interval,
	}
}

func (n *pollingNotifier) notify(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	since, err := n.backend.listLatestRVs(ctx)
	if err != nil {
		return nil, fmt.Errorf("watch, get latest resource version: %w", err)
	}
	stream := make(chan *resource.WrittenEvent, n.backend.watchBufferSize)
	go n.poller(ctx, since, stream)
	return stream, nil
}

func (n *pollingNotifier) poller(ctx context.Context, since groupResourceRV, stream chan<- *resource.WrittenEvent) {
	t := time.NewTicker(n.pollingInterval)
	defer close(stream)
	defer t.Stop()
	isSQLite := n.backend.dialect.DialectName() == "sqlite"

	for {
		select {
		case <-n.backend.done:
			return
		case <-t.C:
			// Block polling during import to avoid database locked issues.
			if isSQLite && n.backend.batchLock.Active() {
				continue
			}

			ctx, span := n.backend.tracer.Start(ctx, tracePrefix+"poller")
			// List the latest RVs ?why?
			grv, err := n.backend.listLatestRVs(ctx)
			if err != nil {
				n.backend.log.Error("poller get latest resource version", "err", err)
				t.Reset(n.backend.pollingInterval)
				continue
			}
			for group, items := range grv {
				for resource := range items {
					// If we haven't seen this resource before, we start from 0
					if _, ok := since[group]; !ok {
						since[group] = make(map[string]int64)
					}
					if _, ok := since[group][resource]; !ok {
						since[group][resource] = 0
					}

					// Poll for new events
					next, err := n.poll(ctx, group, resource, since[group][resource], stream)
					if err != nil {
						n.backend.log.Error("polling for resource", "err", err)
						t.Reset(n.pollingInterval)
						continue
					}
					if next > since[group][resource] {
						since[group][resource] = next
					}
				}
			}

			t.Reset(n.pollingInterval)
			span.End()
		}
	}
}

func (n *pollingNotifier) poll(ctx context.Context, grp string, res string, since int64, stream chan<- *resource.WrittenEvent) (int64, error) {
	ctx, span := n.backend.tracer.Start(ctx, tracePrefix+"poll")
	defer span.End()

	start := time.Now()
	var records []*historyPollResponse
	err := n.backend.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		records, err = dbutil.Query(ctx, tx, sqlResourceHistoryPoll, &sqlResourceHistoryPollRequest{
			SQLTemplate:          sqltemplate.New(n.backend.dialect),
			Resource:             res,
			Group:                grp,
			SinceResourceVersion: since,
			Response:             &historyPollResponse{},
		})
		return err
	})
	if err != nil {
		return 0, fmt.Errorf("poll history: %w", err)
	}
	end := time.Now()
	resource.NewStorageMetrics().PollerLatency.Observe(end.Sub(start).Seconds())

	var nextRV int64
	for _, rec := range records {
		if rec.Key.Group == "" || rec.Key.Resource == "" || rec.Key.Name == "" {
			return nextRV, fmt.Errorf("missing key in response")
		}
		nextRV = rec.ResourceVersion
		prevRV := rec.PreviousRV
		if prevRV == nil {
			prevRV = new(int64)
		}
		stream <- &resource.WrittenEvent{
			WriteEvent: resource.WriteEvent{
				Value: rec.Value,
				Key: &resource.ResourceKey{
					Namespace: rec.Key.Namespace,
					Group:     rec.Key.Group,
					Resource:  rec.Key.Resource,
					Name:      rec.Key.Name,
				},
				Type:       resource.WatchEvent_Type(rec.Action),
				PreviousRV: *prevRV,
			},
			Folder:          rec.Folder,
			ResourceVersion: rec.ResourceVersion,
			// Timestamp:  , // TODO: add timestamp
		}
		n.backend.log.Debug("poller sent event to stream", "namespace", rec.Key.Namespace, "group", rec.Key.Group, "resource", rec.Key.Resource, "name", rec.Key.Name, "action", rec.Action, "rv", rec.ResourceVersion)
	}

	return nextRV, nil
}

func (n *pollingNotifier) send(_ context.Context, _ *resource.WrittenEvent) {
	// No-op for polling strategy - changes are detected via polling
}

func (n *pollingNotifier) close() {
	// No-op for polling strategy
}
