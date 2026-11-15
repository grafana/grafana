package sql

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/time/rate"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// natsHydrateBatchSize bounds the bodies one history read holds, like
// readChunkSize for search reads.
const natsHydrateBatchSize = 10

// defaultNATSSettleDelay is how long a notification waits for ones with lower
// RVs. Each collection commits its RVs in order under a row lock, so only the
// publish path reorders them: the commit-to-publish handoff on the writer and
// the route hop from other instances, both well below this. A later arrival
// expires the watches rather than reaching them out of order.
const defaultNATSSettleDelay = 100 * time.Millisecond

const (
	missingReasonHistoryMissing    = "history_missing"
	missingReasonHistoryReadFailed = "history_read_failed"
	missingReasonLate              = "late"
)

var missingReasons = []string{missingReasonHistoryMissing, missingReasonHistoryReadFailed, missingReasonLate}

// natsNotifier feeds each WatchWriteEvents consumer from its own NATS
// subscription instead of polling the DB, as the KV NATS notifier does. It
// costs one subscription and one history read per write per consumer, and a
// slow consumer only holds back its own stream.
// Delivery is at-most-once: each consumer recovers from its own known
// missing events.
type natsNotifier struct {
	subscriber    resource.EventSubscriber
	dropped       *prometheus.CounterVec
	readHistory   func(ctx context.Context, versions []historyVersion) (map[historyVersion]*historyPollResponse, error)
	listLatestRVs func(ctx context.Context) (groupResourceRV, error)
	invalidator   resource.Invalidator
	missingEvents *prometheus.CounterVec
	// lateLog keeps a too short settle delay from logging every late write.
	lateLog     rate.Sometimes
	log         logging.Logger
	done        <-chan struct{}
	settleDelay time.Duration
	bufferSize  int
}

func newNatsNotifier(cfg notifierConfig) *natsNotifier {
	missingEvents := promauto.With(cfg.reg).NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_storage_server_sql_watch_missing_events_total",
		Help: "Writes the legacy SQL NATS notifier could not deliver to a watch stream consumer, by reason (history_missing, history_read_failed, late).",
	}, []string{"reason"})
	for _, r := range missingReasons {
		missingEvents.WithLabelValues(r)
	}
	settleDelay := cfg.settleDelay
	if settleDelay <= 0 {
		settleDelay = defaultNATSSettleDelay
	}
	return &natsNotifier{
		subscriber:    cfg.subscriber,
		dropped:       resource.NewNatsNotifierDroppedMetric(cfg.reg),
		readHistory:   cfg.readHistory,
		listLatestRVs: cfg.listLatestRVs,
		invalidator:   cfg.invalidator,
		missingEvents: missingEvents,
		lateLog:       rate.Sometimes{Interval: 10 * time.Second},
		log:           cfg.log,
		done:          cfg.done,
		settleDelay:   settleDelay,
		bufferSize:    cfg.watchBufferSize,
	}
}

// missingEvent is a write a consumer may have missed: known ones list the
// lost versions, bus drops and reconnects list none.
type missingEvent struct {
	reason string
	lost   []historyVersion
	// overtakenBy is the highest RV already delivered for the lost writes'
	// collection, when one overtook them: resumes from it miss them too. A
	// fresh list returns an RV above it, because the resource version table
	// holds the next RV, so the floor can go just above it.
	overtakenBy int64
}

// notify serves consumers other than the watch server, which uses
// watchWithFloors. A missing event closes the stream, so the consumer reopens
// it and recovers as it does from any closed stream, and client watches go on.
func (n *natsNotifier) notify(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	_, out, err := n.subscribe(ctx, func(_ missingEvent, stop func()) { stop() }, nil)
	return out, err
}

// invalidateFunc lets a consumer handle its own missed events.
type invalidateFunc func()

func (f invalidateFunc) Invalidate() { f() }

// watchWithFloors starts the watch server's stream once the bus confirms
// capture, with the latest RVs as floors. Its missing events raise the floors
// above what it lost, then expire the watches, so resumes from before a lost
// write expire too.
func (n *natsNotifier) watchWithFloors(ctx context.Context, floors resource.ResumeFloors, captured func()) (map[resource.GroupResource]int64, <-chan *resource.WrittenEvent, error) {
	gaps := resource.NewUnknownGaps(floors, n.raiseFloorsToLatest(floors), n.log)
	since, events, err := n.subscribe(ctx, func(e missingEvent, _ func()) {
		if len(e.lost) == 0 {
			// The lost writes are not known yet, so every resume is held before
			// the watches expire, until the floors are raised above them.
			gaps.Report()
			n.expireWatches(e, nil)
			return
		}
		// A resume admitted after the expiry takes the new generation, so only
		// a floor raised before it can reject the resume.
		for _, v := range e.lost {
			floors.Raise(resource.GroupResource{Group: v.Group, Resource: v.Resource}, max(v.ResourceVersion, e.overtakenBy+1))
		}
		n.expireWatches(e, nil)
	}, func() {
		// Always set, so subscribe reads the floors only once the bus captures
		// every later write.
		gaps.Capture(captured)
	})
	if err != nil {
		// The bus can report a gap before the start fails, for example a
		// reconnect after capture; its hold must not outlive this start.
		gaps.Abandon()
		return nil, nil, err
	}
	go gaps.RaiseFloors(ctx, n.done)

	initial := make(map[resource.GroupResource]int64)
	for group, resources := range since {
		for res, rv := range resources {
			initial[resource.GroupResource{Group: group, Resource: res}] = rv
		}
	}
	return initial, events, nil
}

// raiseFloorsToLatest raises every collection's floor to its latest RV, which
// is above any write lost before a bus drop or reconnect was reported.
func (n *natsNotifier) raiseFloorsToLatest(floors resource.ResumeFloors) func(context.Context) error {
	return func(ctx context.Context) error {
		latest, err := n.listLatestRVs(ctx)
		if err != nil {
			return err
		}
		for group, resources := range latest {
			for res, rv := range resources {
				floors.Raise(resource.GroupResource{Group: group, Resource: res}, rv)
			}
		}
		return nil
	}
}

// subscribe starts a consumer after the latest RVs, as a poller does, and
// returns them. With captured set, it reads them once the bus confirms the
// subscription, so every later write reaches the stream, and calls captured
// right after the confirmation. onMissingEvent gets
// the missing event and a stop for this consumer's stream; it must not block.
func (n *natsNotifier) subscribe(ctx context.Context, onMissingEvent func(missingEvent, func()), captured func()) (groupResourceRV, <-chan *resource.WrittenEvent, error) {
	out := make(chan *resource.WrittenEvent, n.bufferSize)
	select {
	case <-n.done:
		if captured != nil {
			return nil, nil, errors.New("storage backend stopped")
		}
		// The stream ended with the backend, as a poller's does.
		close(out)
		return nil, out, nil
	default:
	}
	ctx, cancel := context.WithCancel(ctx)
	onMissing := func(e missingEvent) { onMissingEvent(e, cancel) }
	go func() {
		select {
		case <-n.done:
			cancel()
		case <-ctx.Done():
		}
	}()
	// Subscribing before reading the RVs captures every later write.
	ready := make(chan error, 1)
	bus := resource.NewNatsNotifier(n.subscriber, invalidateFunc(func() { onMissing(missingEvent{}) }), n.dropped, n.log)
	// Legacy SQL RVs are per collection, so collections settle independently.
	// Late arrivals come through out of order and deliver reports them, after
	// the startup floor filters those already covered.
	events := bus.Watch(ctx, resource.WatchOptions{
		SettleDelay:         n.settleDelay,
		CaptureReady:        ready,
		SettlePerCollection: true,
	})
	if captured != nil {
		select {
		case <-ready:
		case <-ctx.Done():
			cancel()
			return nil, nil, fmt.Errorf("watch, wait for the bus subscription: %w", ctx.Err())
		}
		captured()
	}
	since, err := n.listLatestRVs(ctx)
	if err != nil {
		cancel()
		return nil, nil, fmt.Errorf("watch, get latest resource version: %w", err)
	}
	go n.run(ctx, events, since, out, onMissing)
	return since, out, nil
}

// send is a no-op: local writes come back through the bus, in RV order.
func (n *natsNotifier) send(context.Context, *resource.WrittenEvent) {}

// close is a no-op: streams end with their consumer's context or the backend.
func (n *natsNotifier) close() {}

func (n *natsNotifier) run(ctx context.Context, events <-chan resource.Event, since groupResourceRV, out chan<- *resource.WrittenEvent, onMissingEvent func(missingEvent)) {
	defer close(out)
	buf := make([]resource.Event, 0, natsHydrateBatchSize)
	delivered := make(map[resource.GroupResource]int64)
	for {
		batch, ok := nextEventBatch(events, buf[:0])
		if !ok {
			return
		}
		if !n.deliver(ctx, batch, since, delivered, out, onMissingEvent) {
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
// without bodies meanwhile. delivered holds the highest RV passed on per
// collection. It returns false once ctx ends.
func (n *natsNotifier) deliver(ctx context.Context, batch []resource.Event, since groupResourceRV, delivered map[resource.GroupResource]int64, out chan<- *resource.WrittenEvent, onMissingEvent func(missingEvent)) bool {
	var versions []historyVersion
	var events []resource.Event
	for _, e := range batch {
		if e.ResourceVersion <= since[e.Group][e.Resource] {
			continue
		}
		gr := resource.GroupResource{Group: e.Group, Resource: e.Resource}
		if e.ResourceVersion <= delivered[gr] {
			// It arrived after a later write of its collection settled, so the
			// consumer may already have moved past it.
			n.lateLog.Do(func() {
				n.log.Warn("watch notification arrived after a later one of its collection, expiring watches",
					"group", e.Group, "resource", e.Resource, "resource_version", e.ResourceVersion, "settle_delay", n.settleDelay)
			})
			n.missingEvents.WithLabelValues(missingReasonLate).Inc()
			onMissingEvent(missingEvent{reason: missingReasonLate, lost: []historyVersion{eventHistoryVersion(e)}, overtakenBy: delivered[gr]})
			continue
		}
		delivered[gr] = e.ResourceVersion
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
		onMissingEvent(missingEvent{reason: missingReasonHistoryReadFailed, lost: versions})
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
		onMissingEvent(missingEvent{reason: missingReasonHistoryMissing, lost: missing})
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
func (n *natsNotifier) expireWatches(missingEvent, func()) {
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
