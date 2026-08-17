package state

// LOGZ.IO GRAFANA CHANGE :: APPZ-3028 Logzio state observer
//
// Fork convention: upstream files get at most one-line hooks that call an event method on this
// observer (onSomethingHappened). The observer dispatches each event to one internal method per
// piece of logzio logic. All logzio state-domain logic lives in this file, so upstream rebases
// only ever conflict on trivial hook lines.
//
// The observer is observation-only by design: it logs, counts and tracks, and never changes any
// state or behavior. Fork changes that DO alter behavior must stay as explicit, flag-gated
// LOGZ.IO blocks in the upstream code, where a reviewer can see them.
//
// Current logic pieces:
//
//  1. Rule activity tracking: remembers when each rule was last evaluated on this pod.
//  2. State cache compare: validation instrument for removing the per-tick full cache reload
//     (the "targeted warm" work). The reload exists to repair cache staleness that should never
//     occur as long as every rule is evaluated by a single pod. On every warm cycle the observer
//     compares the freshly loaded database snapshot against the in-memory cache, for the rules
//     this pod actually evaluates, and logs what differs.
//
// How to read the compare signal:
//   - missing_in_cache / newer_in_db / value_mismatch sustained above zero: another writer touches
//     rules this pod considers its own. The single-writer assumption does not hold. Investigate.
//   - single-tick blips: expected. Legitimate deletes (stale series cleanup, rule reset or delete)
//     remove rows between the snapshot read and the compare. State fields are also read without
//     the per-rule synchronization (like every state API reader), so a torn read can produce a
//     one-off false positive.
//   - the compare cannot see a pod that evaluates the same rule for the same tick with identical
//     results. That case is benign, and is measurable separately from the eval-request logs.

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/infra/log"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// compareActiveWindow scopes the comparison to rules evaluated on this pod recently. Rules
	// evaluated elsewhere have no invariant to check: the local copy is naturally one tick behind.
	compareActiveWindow = 15 * time.Minute
	// compareTimestampEpsilon absorbs timestamp precision loss on the database round trip.
	// Real cross-pod divergence differs by at least one full evaluation interval.
	compareTimestampEpsilon = time.Second
	// compareMaxDetails caps per-cycle detail log lines so a systemic problem cannot flood the log.
	compareMaxDetails = 10
)

type logzioStateObserver struct {
	log          log.Logger
	clock        clock.Clock
	cache        *cache
	ruleActivity *ruleActivityTracker

	// lastWarmSnapshot is when the last fully loaded snapshot was applied to the cache (unix
	// nanoseconds, 0 = never). It is the freshness baseline for rules never evaluated on this pod.
	lastWarmSnapshot atomic.Int64
}

func newLogzioStateObserver(logger log.Logger, clk clock.Clock, c *cache) *logzioStateObserver {
	return &logzioStateObserver{
		log:          logger,
		clock:        clk,
		cache:        c,
		ruleActivity: newRuleActivityTracker(),
	}
}

// ---- Event hooks, one per upstream call site ----

// onRuleEvaluated is called by ProcessEvalResults for every evaluation this pod performs.
func (o *logzioStateObserver) onRuleEvaluated(key ngModels.AlertRuleKey, evaluatedAt time.Time) {
	o.updateRuleLastActivity(key, evaluatedAt)
}

// onWarmSnapshotLoaded is called by Warm with the freshly loaded database snapshot, right before
// the snapshot replaces the cache.
func (o *logzioStateObserver) onWarmSnapshotLoaded(snapshot map[int64]map[string]*ruleStates) {
	o.compareSnapshotWithCache(snapshot)
	o.lastWarmSnapshot.Store(o.clock.Now().UnixNano())
}

// lastWarmSnapshotAt returns when the last fully loaded snapshot was applied, zero when never.
func (o *logzioStateObserver) lastWarmSnapshotAt() time.Time {
	nanos := o.lastWarmSnapshot.Load()
	if nanos == 0 {
		return time.Time{}
	}
	return time.Unix(0, nanos)
}

// lastRuleActivity returns when the rule was last evaluated on this pod. Rules never evaluated
// here fall back to the last applied full-warm snapshot: that is exactly how fresh their cached
// copy is.
func (o *logzioStateObserver) lastRuleActivity(key ngModels.AlertRuleKey) time.Time {
	if at, ok := o.ruleActivity.get(key); ok {
		return at
	}
	return o.lastWarmSnapshotAt()
}

// ---- Logic piece 1: rule activity tracking ----

// ruleActivityTracker records when each rule was last evaluated on this pod.
type ruleActivityTracker struct {
	mtx      sync.Mutex
	lastEval map[ngModels.AlertRuleKey]time.Time
}

func newRuleActivityTracker() *ruleActivityTracker {
	return &ruleActivityTracker{lastEval: make(map[ngModels.AlertRuleKey]time.Time)}
}

func (o *logzioStateObserver) updateRuleLastActivity(key ngModels.AlertRuleKey, evaluatedAt time.Time) {
	o.ruleActivity.touch(key, evaluatedAt)
}

func (t *ruleActivityTracker) touch(key ngModels.AlertRuleKey, evaluatedAt time.Time) {
	t.mtx.Lock()
	defer t.mtx.Unlock()
	t.lastEval[key] = evaluatedAt
}

func (t *ruleActivityTracker) get(key ngModels.AlertRuleKey) (time.Time, bool) {
	t.mtx.Lock()
	defer t.mtx.Unlock()
	at, ok := t.lastEval[key]
	return at, ok
}

// entries returns a copy of the tracked activity.
func (t *ruleActivityTracker) entries() map[ngModels.AlertRuleKey]time.Time {
	t.mtx.Lock()
	defer t.mtx.Unlock()
	out := make(map[ngModels.AlertRuleKey]time.Time, len(t.lastEval))
	for key, at := range t.lastEval {
		out[key] = at
	}
	return out
}

// prune drops entries older than the cutoff, so deleted rules do not accumulate.
func (t *ruleActivityTracker) prune(cutoff time.Time) {
	t.mtx.Lock()
	defer t.mtx.Unlock()
	for key, at := range t.lastEval {
		if at.Before(cutoff) {
			delete(t.lastEval, key)
		}
	}
}

// ---- Logic piece 2: state cache compare ----

type stateCacheCompareSummary struct {
	activeRules    int
	statesChecked  int
	missingInCache int
	newerInDB      int
	valueMismatch  int
}

// compareSnapshotWithCache compares the loaded database snapshot against the current in-memory
// cache and logs the differences. Scoped to rules recently evaluated on this pod, which also makes
// the startup warm call a no-op (nothing was evaluated yet). Log-only, no config on purpose.
func (o *logzioStateObserver) compareSnapshotWithCache(snapshot map[int64]map[string]*ruleStates) *stateCacheCompareSummary {
	cutoff := o.clock.Now().Add(-compareActiveWindow)
	o.ruleActivity.prune(cutoff)

	summary := &stateCacheCompareSummary{}
	details := 0
	logDetail := func(kind string, key ngModels.AlertRuleKey, cacheID string, snapshotLastEval, cacheLastEval time.Time) {
		if details >= compareMaxDetails {
			return
		}
		details++
		o.log.Warn("State cache compare found a discrepancy", "kind", kind, "rule_uid", key.UID, "org_id", key.OrgID, "cache_id", cacheID, "snapshot_last_eval", snapshotLastEval, "cache_last_eval", cacheLastEval)
	}

	for key, lastEval := range o.ruleActivity.entries() {
		if lastEval.Before(cutoff) {
			continue
		}
		summary.activeRules++

		snapshotRule := snapshot[key.OrgID][key.UID]
		if snapshotRule == nil {
			// The database holds nothing for this rule. Legitimate right after a rule reset or
			// delete. Not the dangerous direction.
			continue
		}
		view := o.cache.getRuleStatesView(key.OrgID, key.UID)
		for cacheID, snapshotState := range snapshotRule.states {
			summary.statesChecked++
			cacheState, ok := view[cacheID]
			if !ok {
				summary.missingInCache++
				logDetail("missing_in_cache", key, cacheID, snapshotState.LastEvaluationTime, time.Time{})
				continue
			}
			diff := snapshotState.LastEvaluationTime.Sub(cacheState.LastEvaluationTime)
			switch {
			case diff > compareTimestampEpsilon:
				summary.newerInDB++
				logDetail("newer_in_db", key, cacheID, snapshotState.LastEvaluationTime, cacheState.LastEvaluationTime)
			case diff >= -compareTimestampEpsilon && !statesEquivalent(snapshotState, cacheState):
				summary.valueMismatch++
				logDetail("value_mismatch", key, cacheID, snapshotState.LastEvaluationTime, cacheState.LastEvaluationTime)
			}
			// Snapshot older than cache: this pod wrote after the snapshot was read. Expected.
		}
	}

	o.log.Info("State cache compare finished", "active_rules", summary.activeRules, "states_checked", summary.statesChecked, "missing_in_cache", summary.missingInCache, "newer_in_db", summary.newerInDB, "value_mismatch", summary.valueMismatch)
	return summary
}

// statesEquivalent compares the fields that survive the database round trip.
func statesEquivalent(a, b *State) bool {
	return a.State == b.State &&
		a.StateReason == b.StateReason &&
		timesClose(a.StartsAt, b.StartsAt) &&
		timesClose(a.EndsAt, b.EndsAt)
}

func timesClose(a, b time.Time) bool {
	d := a.Sub(b)
	return d >= -compareTimestampEpsilon && d <= compareTimestampEpsilon
}

// getRuleStatesView returns a shallow copy of one rule's cache entry, nil when absent.
func (c *cache) getRuleStatesView(orgID int64, alertRuleUID string) map[string]*State {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	rs, ok := c.states[orgID][alertRuleUID]
	if !ok {
		return nil
	}
	view := make(map[string]*State, len(rs.states))
	for id, s := range rs.states {
		view[id] = s
	}
	return view
}

// LOGZ.IO GRAFANA CHANGE :: End
