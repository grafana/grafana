package informer

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/dskit/backoff"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Acts on what freshness.go measures. A read counted as behind is a read that
// missed a write already announced to this replica, so the reconcile it feeds
// would act on superseded state; re-reading is what resolves it, where
// returning the stale object defers the event to the next re-list.
//
// The two legal executions freshness.go excludes stay excluded here, for the
// same reasons and by the same means: the announced version is sampled before
// every attempt's read, and a NotFound is passed through rather than re-read.
// Enforcement judges each read against the very sample the observation records
// it against, so the two can never disagree about the same read.

// ErrStaleRead reports that a reconcile read kept coming back older than the
// version announced before it was issued. The announced version is a committed
// write, so this is a read-visibility lag and not missing state: the caller
// should re-queue the key rather than reconcile what it was handed.
var ErrStaleRead = errors.New("read is older than the notification that triggered it")

const (
	// How long a read waits in place for the API to catch up with an announced
	// write before the key goes back to the work queue. Four reads 250ms apart
	// covers a brief replication lag; anything longer belongs to the queue's own
	// backoff, and ultimately to the re-list.
	staleReadAttempts = 4
	staleReadBackoff  = 250 * time.Millisecond
)

// staleReadPolicy is what readFresh needs to judge and bound a read.
type staleReadPolicy struct {
	announced announcedVersions
	rec       FreshnessRecorder
	attempts  int
	backoff   time.Duration
}

func newStaleReadPolicy(announced announcedVersions, rec FreshnessRecorder) staleReadPolicy {
	return staleReadPolicy{announced: announced, rec: rec, attempts: staleReadAttempts, backoff: staleReadBackoff}
}

// readFresh re-reads while the result is older than the version announced
// before the read, and returns ErrStaleRead if the attempts run out. fetch is
// handed that sampled version so it can record the same comparison.
func readFresh[T runtime.Object](ctx context.Context, p staleReadPolicy, namespace, name string, fetch func(ctx context.Context, announced int64) (T, error)) (T, error) {
	var zero T
	attempts := max(p.attempts, 1)
	// A fixed delay: the wait exists to let a replication lag pass, not to shed
	// load, so there is nothing to back off from. backoff owns the attempt count
	// and the context, and skips the wait after the last attempt.
	retry := backoff.New(ctx, backoff.Config{MinBackoff: p.backoff, MaxBackoff: p.backoff, MaxRetries: attempts})

	// What the last rejected attempt compared, for the error it ends with.
	var lastAnnounced, lastObserved int64
	for retry.Ongoing() {
		// Sampled per attempt, and before the read: an announcement that lands
		// while a read is in flight says nothing about that read, while one that
		// landed before this attempt is the version this attempt has to meet.
		announced := p.announced.Announced(namespace, name)

		obj, err := fetch(ctx, announced)
		if err != nil || announced <= 0 {
			return obj, err
		}
		rv := objectSnowflakeRV(obj)
		if rv == 0 || rv >= announced {
			return obj, nil
		}
		lastAnnounced, lastObserved = announced, rv
		retry.Wait()
	}
	if ctx.Err() != nil {
		return zero, ctx.Err()
	}

	p.rec.recordExhausted()
	return zero, fmt.Errorf("%w: %s/%s came back at resource version %d over %d reads, %d was announced",
		ErrStaleRead, namespace, name, lastObserved, attempts, lastAnnounced)
}

// retryStaleRepositoryReads wraps the observing getter so a read behind the
// announced version is re-read rather than reconciled. It wraps the observer
// rather than the client so every attempt is measured, and so both layers judge
// a read against one sample.
func retryStaleRepositoryReads(observed freshnessRepositoryGetter, rec FreshnessRecorder) RepositoryGetter {
	return staleReadRepositoryGetter{
		freshnessRepositoryGetter: observed,
		policy:                    newStaleReadPolicy(observed.announced, rec),
	}
}

type staleReadRepositoryGetter struct {
	freshnessRepositoryGetter
	policy staleReadPolicy
}

func (g staleReadRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	return readFresh(ctx, g.policy, namespace, name, func(ctx context.Context, announced int64) (*provisioningapis.Repository, error) {
		return g.getAt(ctx, namespace, name, announced)
	})
}

// retryStaleConnectionReads is retryStaleRepositoryReads for connections.
func retryStaleConnectionReads(observed freshnessConnectionGetter, rec FreshnessRecorder) ConnectionGetter {
	return staleReadConnectionGetter{
		freshnessConnectionGetter: observed,
		policy:                    newStaleReadPolicy(observed.announced, rec),
	}
}

type staleReadConnectionGetter struct {
	freshnessConnectionGetter
	policy staleReadPolicy
}

func (g staleReadConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return readFresh(ctx, g.policy, namespace, name, func(ctx context.Context, announced int64) (*provisioningapis.Connection, error) {
		return g.getAt(ctx, namespace, name, announced)
	})
}
