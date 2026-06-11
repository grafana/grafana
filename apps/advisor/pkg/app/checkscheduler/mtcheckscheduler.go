package checkscheduler

import (
	"context"
	"fmt"
	"maps"
	"math/rand"
	"sort"
	"sync"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/advisor/pkg/app/metrics"
	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const maxConcurrency = 10

// runMT runs the multi-tenant scheduler loop. Namespaces are discovered
// cluster-wide from existing Check resources, lastCreated state is tracked
// in-memory between ticks, and per-namespace work is fanned out under
// maxConcurrency.
func (r *Runner) runMT(ctx context.Context, logger logging.Logger) error {
	logger = logger.With("mode", "mt")
	ctxWithoutCancel := context.WithoutCancel(ctx)

	namespaces, lastCreatedMap, err := r.discoverNamespaces(ctxWithoutCancel, logger)
	if err != nil {
		logger.Debug("checkscheduler step failed", "step", "discoverNamespaces.initial", "error", err)
		return fmt.Errorf("failed to discover namespaces (cluster-wide checks list): %w", err)
	}
	logger.Debug("checkscheduler step", "step", "discoverNamespaces.initial", "length_namespaces", len(namespaces))

	r.runInitialCleanupParallelMT(ctx, logger, namespaces, lastCreatedMap)
	// Eagerly run a tick so any tenants whose last check is already stale at
	// startup get processed now instead of waiting up to defaultEvalInterval.
	// The MT ticker fires on a fixed cadence (see mtTickInterval), so without
	// this we'd be relying on the next tick — which can be a full evaluation
	// interval away — to catch up stale tenants discovered at boot.
	r.runTickParallelMT(ctx, logger, namespaces, lastCreatedMap)

	nextEvalTime := r.mtTickInterval()
	logger.Debug("checkscheduler initial ticker interval", "next_eval", nextEvalTime)
	ticker := time.NewTicker(nextEvalTime)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			logger.Debug("checkscheduler step", "step", "discoverNamespaces.tick", "detail", "cluster-wide Check list")
			namespaces, lastCreatedMap, err = r.discoverNamespaces(ctxWithoutCancel, logger)
			if err != nil {
				// A discovery failure mid-loop signals a real problem (RBAC, apiserver
				// reachability, etc.) that the runner shouldn't silently retry through:
				// tear down so the app-sdk runtime can surface it and restart us.
				logger.Error("Error discovering namespaces, stopping scheduler", "error", err)
				return fmt.Errorf("failed to discover namespaces (cluster-wide checks list): %w", err)
			}
			r.runTickParallelMT(ctx, logger, namespaces, lastCreatedMap)

			nextEvalTime = r.mtTickInterval()
			logger.Debug("checkscheduler tick complete", "next_eval", nextEvalTime)
			ticker.Reset(nextEvalTime)
		case <-ctx.Done():
			logger.Debug("checkscheduler stopping", "reason", "context_done")
			return ctx.Err()
		}
	}
}

// mtTickInterval returns the MT scheduler tick interval.
//
// We deliberately don't use getNextEvalTime in MT: lastCreated is aggregated
// across many tenants and the oldest entry is almost always older than
// defaultEvalInterval, which collapses that calculation to ~0 and turns the
// ticker into a busy loop bounded only by evalIntervalRandomVariation.
// Instead we fire on a fixed cadence and let tickNamespace skip per-namespace
// work that isn't stale yet.
func (r *Runner) mtTickInterval() time.Duration {
	jitter := time.Duration(rand.Int63n(evalIntervalRandomVariation.Nanoseconds()))
	return r.defaultEvalInterval + jitter
}

// discoverNamespaces lists Check objects cluster-wide (namespace ""), paginates, and returns
// every cloud-stack namespace that has at least one check, plus the latest creation time per namespace.
func (r *Runner) discoverNamespaces(ctx context.Context, log logging.Logger) ([]string, map[string]time.Time, error) {
	start := time.Now()
	var discoveryErr error
	defer func() {
		metrics.MTSchedulerDiscoveryDurationSeconds.Observe(time.Since(start).Seconds())
		if discoveryErr != nil {
			metrics.MTSchedulerDiscoveriesTotal.WithLabelValues("error").Inc()
		} else {
			metrics.MTSchedulerDiscoveriesTotal.WithLabelValues("success").Inc()
		}
	}()

	// List Check metadata cluster-wide (namespace ""); discovery only reads
	// each Check's namespace and creation timestamp.
	items, err := r.listChecksMetadata(ctx, log, metav1.NamespaceAll)
	if err != nil {
		log.Debug("checkscheduler discoverNamespaces cluster-wide Check list failed", "error", err)
		discoveryErr = err
		return nil, nil, err
	}

	lastCreated := make(map[string]time.Time)
	skipped := 0
	for i := range items {
		ns := items[i].GetNamespace()
		info, parseErr := types.ParseNamespace(ns)
		if parseErr != nil || info.StackID == 0 {
			skipped++
			continue
		}
		itemCreated := items[i].GetCreationTimestamp().Time
		if itemCreated.After(lastCreated[ns]) {
			lastCreated[ns] = itemCreated
		}
	}

	namespaces := make([]string, 0, len(lastCreated))
	for ns := range lastCreated {
		namespaces = append(namespaces, ns)
	}
	sort.Strings(namespaces)
	metrics.MTSchedulerNamespacesDiscovered.Set(float64(len(namespaces)))
	log.Debug("checkscheduler discoverNamespaces complete", "checks_total", len(items),
		"skipped_non_stack", skipped, "stack_namespace_count", len(namespaces))
	return namespaces, lastCreated, nil
}

// runInitialCleanupParallelMT cleans up stale checks and marks unprocessed
// checks as errored for every discovered namespace with at least one existing
// check, in parallel, bounded by r.maxConcurrency.
func (r *Runner) runInitialCleanupParallelMT(ctx context.Context, logger logging.Logger, namespaces []string, lastCreated map[string]time.Time) {
	toClean := 0
	for _, ns := range namespaces {
		if !lastCreated[ns].IsZero() {
			toClean++
		}
	}
	logger.Debug("checkscheduler MT initial cleanup start", "namespaces_total", len(namespaces), "with_existing_checks", toClean, "max_concurrency", maxConcurrency)

	var g errgroup.Group
	g.SetLimit(maxConcurrency)
	for _, namespace := range namespaces {
		namespace := namespace
		if lastCreated[namespace].IsZero() {
			continue
		}
		g.Go(func() error {
			nsLogger := logger.With("namespace", namespace)
			nsLogger.Debug("checkscheduler MT initial cleanup namespace", "step", "begin")
			if err := r.cleanupChecks(ctx, nsLogger, namespace); err != nil {
				nsLogger.Error("Error cleaning up old check reports", "error", err)
				return nil
			}
			if err := r.markUnprocessedChecks(ctx, nsLogger, namespace); err != nil {
				nsLogger.Error("Error marking unprocessed checks", "error", err)
				return nil
			}
			nsLogger.Debug("checkscheduler MT initial cleanup namespace", "step", "done")
			return nil
		})
	}
	_ = g.Wait()
	logger.Debug("checkscheduler MT initial cleanup finished")
}

// runTickParallelMT processes a scheduler tick across all discovered
// namespaces in parallel, updating lastCreatedMap with the new per-namespace
// timestamps. Per-namespace errors are swallowed (and logged) so one bad
// tenant can't stop the whole tick.
func (r *Runner) runTickParallelMT(ctx context.Context, logger logging.Logger, namespaces []string, lastCreatedMap map[string]time.Time) {
	logger.Debug("checkscheduler MT tick start", "namespaces", len(namespaces), "max_concurrency", maxConcurrency)
	var mu sync.Mutex
	updates := make(map[string]time.Time, len(namespaces))
	var g errgroup.Group
	g.SetLimit(maxConcurrency)
	for _, namespace := range namespaces {
		namespace := namespace
		last := lastCreatedMap[namespace]
		g.Go(func() error {
			nsLogger := logger.With("namespace", namespace)
			newLast, err := r.tickNamespace(ctx, nsLogger, namespace, last)
			if err != nil {
				nsLogger.Error("Error during scheduled check tick", "error", err)
				return nil
			}
			if newLast.Equal(last) {
				return nil
			}
			mu.Lock()
			updates[namespace] = newLast
			mu.Unlock()
			return nil
		})
	}
	_ = g.Wait()
	maps.Copy(lastCreatedMap, updates)
	logger.Debug("checkscheduler MT tick finished", "updated_namespaces", len(updates))
}

// tickNamespace creates new checks and cleans up when the last batch is older
// than the evaluation interval. Returns the new "last created" time, or the
// input lastCreated if no work was needed.
func (r *Runner) tickNamespace(ctx context.Context, log logging.Logger, namespace string, lastCreated time.Time) (time.Time, error) {
	start := time.Now()
	var tickResult string
	var observeDuration bool
	defer func() {
		metrics.MTSchedulerNamespaceTicksTotal.WithLabelValues(tickResult).Inc()
		if observeDuration {
			metrics.MTSchedulerNamespaceTickDurationSeconds.Observe(time.Since(start).Seconds())
		}
	}()

	if lastCreated.IsZero() {
		log.Debug("checkscheduler tickNamespace skip", "reason", "no_existing_checks", "last_created_zero", true)
		tickResult = "skipped_no_checks"
		return lastCreated, nil
	}
	deadline := time.Now().Add(-r.defaultEvalInterval)
	if !lastCreated.Before(deadline) {
		log.Debug("checkscheduler tickNamespace skip", "reason", "not_stale_yet",
			"last_created", lastCreated, "eval_deadline", deadline, "eval_interval", r.defaultEvalInterval)
		tickResult = "skipped_not_stale"
		return lastCreated, nil
	}
	observeDuration = true
	log.Debug("checkscheduler tickNamespace run", "step", "createChecks", "last_created", lastCreated)
	if err := r.createChecks(ctx, log, namespace); err != nil {
		log.Debug("checkscheduler tickNamespace failed", "step", "createChecks", "error", err)
		tickResult = "error"
		return lastCreated, err
	}
	log.Debug("checkscheduler tickNamespace run", "step", "cleanupChecks")
	if err := r.cleanupChecks(ctx, log, namespace); err != nil {
		log.Debug("checkscheduler tickNamespace failed", "step", "cleanupChecks", "error", err)
		tickResult = "error"
		return lastCreated, err
	}
	log.Debug("checkscheduler tickNamespace done", "new_last_created", time.Now())
	tickResult = "success"
	return time.Now(), nil
}
