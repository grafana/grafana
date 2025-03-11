package sql

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/util"
)

var (
	errPruneBufferFull = errors.New("prune buffer is full")
)

type historyPrunerCfg struct {
	metrics *resource.StorageMetrics

	bufferSize int
	minWait    time.Duration
	maxWait    time.Duration

	keyFunc util.KeyFunc[*resource.ResourceKey]
}

// historyPruner handles pruning of resource history
type historyPruner struct {
	debouncer *util.Debouncer[*resource.ResourceKey]
	metrics   *resource.StorageMetrics
}

// newHistoryPruner creates a new history pruner with the given buffer size
func newHistoryPruner(cfg *historyPrunerCfg) *historyPruner {
	// Create a debouncer with default wait times
	debouncer := util.NewDebouncer(
		cfg.bufferSize,
		cfg.keyFunc,
		cfg.minWait,
		cfg.maxWait,
	)

	return &historyPruner{
		debouncer: debouncer,
		metrics:   cfg.metrics,
	}
}

// Prune adds a resource to the pruning queue
func (h *historyPruner) Prune(ns, grp, res string) error {
	// Create a resource key
	key := &resource.ResourceKey{
		Namespace: ns,
		Group:     grp,
		Resource:  res,
	}

	// Try to add the key to the debouncer
	if !h.debouncer.Add(key) {
		// Buffer is full
		if h.metrics != nil {
			h.metrics.PruneBufferFullCounter.Inc()
		}
		return errPruneBufferFull
	}

	return nil
}

// startWorker starts a background worker to process events with deduplication
func (h *historyPruner) startWorker(ctx context.Context, processFunc func(ctx context.Context, key *resource.ResourceKey) error) {
	// Start the debouncer with the process function
	h.debouncer.Start(ctx, processFunc)
}

// stopWorker stops the background worker
func (h *historyPruner) stopWorker() {
	// Stop the debouncer
	h.debouncer.Stop()
}

// setMinWait sets the minimum wait time between processing the same key
func (h *historyPruner) setMinWait(minWait time.Duration) {
	h.debouncer.SetMinWait(minWait)
}

// setMaxWait sets the maximum wait time before forcing processing
func (h *historyPruner) setMaxWait(maxWait time.Duration) {
	h.debouncer.SetMaxWait(maxWait)
}

// createKeyString creates a unique string key for a ResourceKey
func createKeyString(key *resource.ResourceKey) string {
	return key.Namespace + ":" + key.Group + ":" + key.Resource
}
