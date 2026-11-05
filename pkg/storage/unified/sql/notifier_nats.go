package sql

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// natsHydrateBatchSize bounds the bodies one history read holds, like
// readChunkSize for search reads.
const natsHydrateBatchSize = 10

const (
	missingReasonHistoryMissing    = "history_missing"
	missingReasonHistoryReadFailed = "history_read_failed"
)

var missingReasons = []string{missingReasonHistoryMissing, missingReasonHistoryReadFailed}

// natsNotifier feeds each WatchWriteEvents consumer from its own NATS
// subscription instead of polling the DB, as the KV NATS notifier does. It
// costs one subscription and one history read per write per consumer, and a
// slow consumer only holds back its own stream.
// Delivery is at-most-once: each known missing event expires the watches.
type natsNotifier struct {
	subscriber    resource.EventSubscriber
	dropped       *prometheus.CounterVec
	readHistory   func(ctx context.Context, versions []historyVersion) (map[historyVersion]*historyPollResponse, error)
	listLatestRVs func(ctx context.Context) (groupResourceRV, error)
	invalidator   resource.Invalidator
	missingEvents *prometheus.CounterVec
	log           logging.Logger
	done          <-chan struct{}
	settleDelay   time.Duration
	bufferSize    int
}

func newNatsNotifier(cfg notifierConfig) *natsNotifier {
	missingEvents := promauto.With(cfg.reg).NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_storage_server_sql_watch_missing_events_total",
		Help: "Writes the legacy SQL NATS notifier could not deliver to watches, by reason. They expire the open watches.",
	}, []string{"reason"})
	for _, r := range missingReasons {
		missingEvents.WithLabelValues(r)
	}
	return &natsNotifier{
		subscriber:    cfg.subscriber,
		dropped:       resource.NewNatsNotifierDroppedMetric(cfg.reg),
		readHistory:   cfg.readHistory,
		listLatestRVs: cfg.listLatestRVs,
		invalidator:   cfg.invalidator,
		missingEvents: missingEvents,
		log:           cfg.log,
		done:          cfg.done,
		settleDelay:   cfg.settleDelay,
		bufferSize:    cfg.watchBufferSize,
	}
}

// notify starts a consumer after the latest RVs, as a poller does. A missing
// event expires the watches, since the backend cannot tell the consumers apart.
func (n *natsNotifier) notify(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	out := make(chan *resource.WrittenEvent, n.bufferSize)
	select {
	case <-n.done:
		// The stream ended with the backend, as a poller's does.
		close(out)
		return out, nil
	default:
	}
	ctx, cancel := context.WithCancel(ctx)
	go func() {
		select {
		case <-n.done:
			cancel()
		case <-ctx.Done():
		}
	}()
	// Subscribing before reading the RVs captures every later write.
	bus := resource.NewNatsNotifier(n.subscriber, n.invalidator, n.dropped, n.log)
	events := bus.Watch(ctx, resource.WatchOptions{SettleDelay: n.settleDelay})
	since, err := n.listLatestRVs(ctx)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("watch, get latest resource version: %w", err)
	}
	go n.run(ctx, events, since, out)
	return out, nil
}

// send is a no-op: local writes come back through the bus, in RV order.
func (n *natsNotifier) send(context.Context, *resource.WrittenEvent) {}

// close is a no-op: streams end with their consumer's context or the backend.
func (n *natsNotifier) close() {}

func (n *natsNotifier) run(ctx context.Context, events <-chan resource.Event, since groupResourceRV, out chan<- *resource.WrittenEvent) {
	defer close(out)
	buf := make([]resource.Event, 0, natsHydrateBatchSize)
	for {
		batch, ok := nextEventBatch(events, buf[:0])
		if !ok {
			return
		}
		if !n.deliver(ctx, batch, since, out) {
			return
		}
	}
}

// nextEventBatch waits for one event and takes whatever else is buffered.
func nextEventBatch(events <-chan resource.Event, buf []resource.Event) ([]resource.Event, bool) {
	event, ok := <-events
	if !ok {
		return nil, false
	}
	batch := append(buf, event)
	for len(batch) < cap(batch) {
		select {
		case event, ok := <-events:
			if !ok {
				return batch, true
			}
			batch = append(batch, event)
		default:
			return batch, true
		}
	}
	return batch, true
}

// deliver hydrates a batch and sends it, blocking on a full consumer as a
// poller does, so it misses no write. Its own bus side buffers notifications
// without bodies meanwhile. It returns false once ctx ends.
func (n *natsNotifier) deliver(ctx context.Context, batch []resource.Event, since groupResourceRV, out chan<- *resource.WrittenEvent) bool {
	var versions []historyVersion
	var events []resource.Event
	for _, e := range batch {
		if e.ResourceVersion <= since[e.Group][e.Resource] {
			continue
		}
		versions = append(versions, eventHistoryVersion(e))
		events = append(events, e)
	}
	if len(versions) == 0 {
		return true
	}
	rows, err := n.readHistoryWithRetry(ctx, versions)
	if err != nil {
		if ctx.Err() != nil {
			return false
		}
		n.log.Error("failed to read the history of watch notifications", "events", len(versions), "error", err)
		n.missingEvents.WithLabelValues(missingReasonHistoryReadFailed).Add(float64(len(versions)))
		n.expireWatches()
		return true
	}

	var missing []historyVersion
	for _, v := range versions {
		if _, ok := rows[v]; !ok {
			missing = append(missing, v)
		}
	}
	if len(missing) > 0 {
		// Announced rows are committed, so only pruning removes them. Report
		// them before delivering the rest of the batch, so no watch moves past
		// a missing write before it expires.
		n.log.Warn("watch notifications without history rows", "missing", len(missing), "events", len(versions))
		n.missingEvents.WithLabelValues(missingReasonHistoryMissing).Add(float64(len(missing)))
		n.expireWatches()
	}
	for i, v := range versions {
		row, ok := rows[v]
		if !ok {
			continue
		}
		select {
		case out <- writtenEventFromHistory(row, events[i].PreviousRV):
		case <-ctx.Done():
			return false
		}
	}
	return true
}

func (n *natsNotifier) readHistoryWithRetry(ctx context.Context, versions []historyVersion) (map[historyVersion]*historyPollResponse, error) {
	bo := backoff.New(ctx, backoff.Config{MinBackoff: 100 * time.Millisecond, MaxBackoff: time.Second, MaxRetries: 3})
	var err error
	for bo.Ongoing() {
		var rows map[historyVersion]*historyPollResponse
		if rows, err = n.readHistory(ctx, versions); err == nil {
			return rows, nil
		}
		bo.Wait()
	}
	if err == nil {
		err = bo.Err()
	}
	return nil, err
}

// expireWatches is the watch server's recovery from a missing event: its
// clients list again, and its stream goes on.
func (n *natsNotifier) expireWatches() {
	if n.invalidator != nil {
		n.invalidator.Invalidate()
	}
}

func eventHistoryVersion(e resource.Event) historyVersion {
	return historyVersion{
		Namespace: e.Namespace, Group: e.Group, Resource: e.Resource, Name: e.Name, ResourceVersion: e.ResourceVersion,
	}
}

func writtenEventFromHistory(row *historyPollResponse, previousRV int64) *resource.WrittenEvent {
	return &resource.WrittenEvent{
		Key: &resourcepb.ResourceKey{
			Namespace: row.Key.Namespace,
			Group:     row.Key.Group,
			Resource:  row.Key.Resource,
			Name:      row.Key.Name,
		},
		Value:           row.Value,
		Type:            resourcepb.WatchEvent_Type(row.Action),
		PreviousRV:      previousRV,
		Folder:          row.Folder,
		ResourceVersion: row.ResourceVersion,
	}
}
