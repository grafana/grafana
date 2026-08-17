package state

// LOGZ.IO GRAFANA CHANGE :: APPZ-3028 Logzio state observer
//
// Observation-only fork component. Upstream code calls it through one-line hooks (onXHappened)
// and all logzio state-domain observation lives in this file, so rebases only conflict on the
// hook lines. It never changes state or behavior, and every hook recovers panics, so a bug here
// cannot harm evaluation. Current duties: track when each rule was last evaluated on this pod,
// and compare the warm cycle's database snapshot against the cache for those rules, logging any
// discrepancy (expected: zero, single-tick blips aside).

import (
	"runtime/debug"
	"sync"
	"sync/atomic"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/infra/log"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// compareActiveWindow scopes the compare to rules recently evaluated on this pod.
	compareActiveWindow = 15 * time.Minute
	// compareTimestampEpsilon absorbs timestamp precision loss on the database round trip.
	compareTimestampEpsilon = time.Second
	// compareMaxDetails caps discrepancy detail log lines per cycle.
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
	defer o.recoverPanic("onRuleEvaluated")
	o.updateRuleLastActivity(key, evaluatedAt)
}

// onWarmSnapshotLoaded is called by Warm with the loaded snapshot, right before it replaces the cache.
func (o *logzioStateObserver) onWarmSnapshotLoaded(snapshot map[int64]map[string]*ruleStates) {
	defer o.recoverPanic("onWarmSnapshotLoaded")
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

// recoverPanic keeps observer bugs harmless to the caller: the panic is logged, the observation skipped.
func (o *logzioStateObserver) recoverPanic(event string) {
	if r := recover(); r != nil {
		o.log.Error("Logzio state observer panicked, skipping this observation", "event", event, "panic", r, "stack", string(debug.Stack()))
	}
}

// ---- Rule activity tracking ----

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

// ---- State cache compare ----

type stateCacheCompareSummary struct {
	activeRules    int
	statesChecked  int
	missingInCache int
	newerInDB      int
	valueMismatch  int
}

// compareSnapshotWithCache logs how the snapshot differs from the cache for locally evaluated rules.
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
			// Nothing persisted for this rule: legitimate right after a rule reset or delete.
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
