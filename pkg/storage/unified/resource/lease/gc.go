package lease

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	// how often GC will check for leases that can be garbage collected.
	gcFrequency = 1 * time.Minute

	// maximum amount of time spent running garbage collection per cycle.
	gcMaxCycleDuration = 10 * time.Minute

	// prefix used by internal keys. Callers cannot create lease names with
	// this prefix.
	internalPrefix = "lease-internal/"

	// internal key to provide a best-effort attempt at having a single
	// instance of the GC process running.
	gcKey = internalPrefix + "gc"

	// how long to wait after a lease is released or expired after which it can
	// be deleted.
	gcGracePeriod = time.Minute

	// batch size used when running a GC cycle.
	batchSize = 200
)

// gcMetadata is the data written on the `gcKey` entry.
type gcMetadata struct {
	Expires int64 `json:"expires"`
}

// garbageCollector implements garbage collection of leases acquired using the
// lease manager's `Acquire()` function.
type garbageCollector struct {
	store   kv.KV
	stop    context.CancelFunc
	done    chan struct{}
	log     logging.Logger
	now     func() time.Time
	metrics *Metrics
}

func newGarbageCollector(store kv.KV, log logging.Logger, now func() time.Time, metrics *Metrics) *garbageCollector {
	gc := &garbageCollector{
		store:   store,
		done:    make(chan struct{}),
		log:     log.With("gc", true),
		now:     now,
		metrics: metrics,
	}

	return gc
}

// Start starts the background goroutine that runs GC cycles periodically.
func (gc *garbageCollector) Start() {
	ctx, stop := context.WithCancel(context.Background())
	gc.stop = stop
	go gc.loop(ctx)
}

func (gc *garbageCollector) Stop() {
	gc.stop()
	<-gc.done
}

// loop implements the background garbage collection loop to delete released and
// expired leases. Before any deletion happens, there's a best-effort attempt at
// having a single instance of the garbage collector running, controlled by the
// data written in `gcKey`: the entry is read and, if non-existent or expired, this
// instance will attempt to create the key and run a GC cycle if successful. This is
// a simpler version of what the leases manager provides: we don't want GC to create
// more entries for itself to delete. Also, this process is sufficient to stop avoidable
// duplicated work in the vast majority of cases. It's still possible for two instances
// of the garbage collector to start garbage collection at the same time if the timing
// aligns just right. That is fine, as the GC cycle does not fail in that case.
func (gc *garbageCollector) loop(ctx context.Context) {
	defer close(gc.done)

	// Apply a jitter to the start time of the GC loop to reduce the chances
	// of race when multiple instances start at the same time.
	const maxJitter = int64(time.Minute)
	jitter := time.Duration(rand.Int64N(maxJitter))
	select {
	case <-ctx.Done():
		return
	case <-time.After(jitter):
	}

	next := time.NewTicker(gcFrequency).C

	for {
		select {
		case <-ctx.Done():
			return

		case <-next:
			start := time.Now()
			deleted, err := gc.runOnce(ctx)
			if err != nil {
				gc.logError(err, "error running gc cycle")
			}

			if deleted > 0 {
				gc.log.Info("leases deleted", "count", deleted, "duration", time.Since(start))
			}
		}
	}
}

func (gc *garbageCollector) runOnce(ctx context.Context) (int, error) {
	start := time.Now()
	outcome := outcomeError
	defer func() {
		gc.metrics.observeGCDuration(time.Since(start), outcome)
	}()

	metadata, err := gc.readInternalKey(ctx)
	if err != nil && !errors.Is(err, kv.ErrNotFound) {
		return 0, fmt.Errorf("reading internal key: %w", err)
	}

	if err == nil {
		// Internal key exists: check if it's expired.
		if gc.now().Before(time.Unix(0, metadata.Expires)) {
			// Some other instance of GC is already running.
			outcome = outcomeSkipped
			return 0, nil
		}

		// Internal key is already expired, likely leftover from another
		// run that didn't exit cleanly.
		if err := gc.deleteInternalKey(ctx); err != nil {
			return 0, fmt.Errorf("deleting expired internal key: %w", err)
		}
	}

	// Not found or already expired
	created, err := gc.createInternalKey(ctx)
	if err != nil {
		return 0, fmt.Errorf("creating internal key: %w", err)
	}

	if !created {
		outcome = outcomeSkipped
		return 0, nil
	}

	outcome = outcomeExecuted

	cycleCtx, stop := context.WithTimeout(ctx, gcMaxCycleDuration)
	scanned, deleted, cycleErr := gc.runCycle(cycleCtx)
	stop()

	gc.metrics.addGCKeysScanned(scanned)
	gc.metrics.addGCKeysDeleted(deleted)

	deleteErr := gc.deleteInternalKey(ctx)
	return deleted, errors.Join(cycleErr, deleteErr)
}

func (gc *garbageCollector) readInternalKey(ctx context.Context) (*gcMetadata, error) {
	r, err := gc.store.Get(ctx, kv.LeasesSection, gcKey)
	if err != nil {
		return nil, err
	}
	defer func() { _ = r.Close() }()

	var meta gcMetadata
	if err := json.NewDecoder(r).Decode(&meta); err != nil {
		return nil, fmt.Errorf("decoding GC metadata: %w", err)
	}

	return &meta, nil
}

func (gc *garbageCollector) createInternalKey(ctx context.Context) (bool, error) {
	meta := gcMetadata{
		Expires: gc.now().Add(gcMaxCycleDuration).UnixNano(),
	}

	data, err := json.Marshal(meta)
	if err != nil {
		return false, fmt.Errorf("marshaling gc metadata: %w", err)
	}

	if err := gc.store.Batch(ctx, kv.LeasesSection, []kv.BatchOp{
		{Mode: kv.BatchOpCreate, Key: gcKey, Value: data},
	}); err != nil {
		if errors.Is(err, kv.ErrKeyAlreadyExists) {
			return false, nil
		}
		return false, fmt.Errorf("creating internal key: %w", err)
	}

	return true, nil
}

func (gc *garbageCollector) deleteInternalKey(ctx context.Context) error {
	return gc.store.Delete(ctx, kv.LeasesSection, gcKey)
}

// runCycle runs a single garbage collection cycle. It iterates over the leases
// section in descending key order and deletes leases that have been released
// or expired for longer than `gcGracePeriod`. It returns the total number of
// keys scanned and deleted across all pages.
func (gc *garbageCollector) runCycle(ctx context.Context) (int, int, error) {
	var endKey string
	now := gc.now()
	var totalScanned, totalDeleted int

	for {
		opts := kv.ListOptions{
			EndKey: endKey,
			Limit:  batchSize,
			// Use descending order to make pagination easier: `EndKey`
			// is non-inclusive.
			Sort: kv.SortOrderDesc,
		}

		keys := make([]string, 0, batchSize)
		for key, err := range gc.store.Keys(ctx, kv.LeasesSection, opts) {
			if err != nil {
				return totalScanned, totalDeleted, err
			}
			if isInternal(key) {
				continue
			}
			keys = append(keys, key)
		}

		if len(keys) == 0 {
			return totalScanned, totalDeleted, nil
		}

		totalScanned += len(keys)

		// In a descending listing the last key is the smallest; pagination
		// continues by fetching keys strictly less than it (EndKey is exclusive).
		endKey = keys[len(keys)-1]

		var toDelete []string
		for item, err := range gc.store.BatchGet(ctx, kv.LeasesSection, keys) {
			if err != nil {
				return totalScanned, totalDeleted, err
			}

			var meta leaseMetadata
			if err := json.NewDecoder(item.Value).Decode(&meta); err != nil {
				gc.log.Error("failed to decode lease metadata", "key", item.Key, "err", err)
				_ = item.Value.Close()
				continue
			}

			if eligibleForDeletion(meta, now) {
				toDelete = append(toDelete, item.Key)
			}

			_ = item.Value.Close()
		}

		if len(toDelete) == 0 {
			continue
		}

		if err := gc.store.BatchDelete(ctx, kv.LeasesSection, toDelete); err != nil {
			gc.logError(err, "failed to batch delete leases", "count", len(toDelete))
			continue
		}

		totalDeleted += len(toDelete)
	}
}

// eligibleForDeletion reports whether a lease's metadata says it has been
// released or expired for longer than the GC grace period.
func eligibleForDeletion(meta leaseMetadata, now time.Time) bool {
	leaseExpires := time.Unix(0, meta.Expires)
	longReleased := meta.ReleasedAt > 0 && now.Sub(time.Unix(0, meta.ReleasedAt)) > gcGracePeriod
	return longReleased || now.Sub(leaseExpires) > gcGracePeriod
}

func (gc *garbageCollector) logError(err error, message string, args ...any) {
	// Skip logging errors that come up due to context cancelation errors,
	// which happen naturally when the server is shutting down.
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return
	}

	gc.log.Warn(message, append(args, "err", err)...)
}

func isInternal(key string) bool {
	return strings.HasPrefix(key, internalPrefix)
}
