package state

// LOGZ.IO GRAFANA CHANGE :: APPZ-3028 Targeted state cache warm
//
// Replaces the per-tick full state cache reload when [unified_alerting] targeted_warm_enabled is
// on. All logic and configuration live on LogzioTargetedWarm, a fork-owned component held by the
// Manager in a single field. This changes behavior, so it is deliberately NOT part of the
// observer. The scheduler calls two entry points as bare one-liners, and every decision (mode,
// pause, staleness) is made here: MaintainCache at the end of every tick, and WarmRuleIfNeeded
// right before an evaluation. Three cooperating pieces:
//
//  1. The startup warm-up (unchanged, in Warm) loads all persisted states once, in bulk, so a
//     fresh pod starts with a complete cache and no burst of per-rule queries.
//  2. WarmRuleIfNeeded reloads one rule from the database right before its evaluation when the
//     rule had no local evaluation for TargetedWarmReloadAfter. While a rule keeps evaluating on
//     this pod, its cache is fresher than the database and there is nothing to reload. A gap
//     means the rule may have been evaluated on another pod (which persisted newer states), or
//     that its states were freed by the sweep.
//  3. sweepIdleRuleStates frees the cached states of rules with no local evaluation for
//     TargetedWarmEvictAfter, so per-pod memory converges to the share this pod evaluates. It
//     only touches the cache map, never the database: the rows of a swept rule belong to
//     whichever pod evaluates it.
//
// shadowWarmCompare supports the rollout: it keeps loading the database snapshot every tick like
// the old full reload did, but only feeds it to the state cache compare and discards it. It lets
// us observe zero discrepancies while targeted warm is already active, and is turned off
// afterwards via [unified_alerting] targeted_warm_shadow_compare_enabled.
//
// Freshness bookkeeping comes from the observer: rule activity is recorded on every
// ProcessEvalResults, and rules never evaluated here fall back to the last applied full-warm
// snapshot time.

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// TargetedWarmReloadAfter is how long a rule may go unevaluated on this pod before its cached
	// states are considered stale and are reloaded from the database prior to the next evaluation.
	TargetedWarmReloadAfter = 5 * time.Minute

	// TargetedWarmEvictAfter is how long a rule may go unevaluated on this pod before the idle
	// sweep frees its cached states. It MUST be greater than TargetedWarmReloadAfter: any rule
	// evaluated after eviction is then guaranteed to re-warm first, instead of silently starting
	// from empty state.
	TargetedWarmEvictAfter = 15 * time.Minute
)

// LogzioTargetedWarm owns the targeted-warm behavior and its configuration. The Manager holds it
// in one field, keeping the upstream struct untouched beyond that.
type LogzioTargetedWarm struct {
	enabled       bool
	shadowCompare bool
	manager       *Manager
}

func newLogzioTargetedWarm(cfg ManagerCfg, manager *Manager) *LogzioTargetedWarm {
	return &LogzioTargetedWarm{
		enabled:       cfg.TargetedWarmEnabled,
		shadowCompare: cfg.TargetedWarmShadowCompare,
		manager:       manager,
	}
}

// MaintainCache runs the per-tick state cache maintenance, called by the scheduler at the end of
// every tick. Outside targeted-warm mode it is the original DEV-47243 behavior: a full reload of
// the cache from the database, repairing any staleness. In targeted-warm mode the full reload is
// replaced by the idle sweep, plus a load-and-compare-only cycle while the rollout observation
// window is open.
func (w *LogzioTargetedWarm) MaintainCache(ctx context.Context, rulesReader RuleReader) {
	if !w.enabled {
		w.manager.Warm(ctx, rulesReader)
		return
	}
	if w.shadowCompare {
		w.shadowWarmCompare(ctx)
	}
	w.sweepIdleRuleStates()
}

// WarmRuleIfNeeded reloads the rule's states from the database right before its evaluation, when
// targeted-warm mode is on, the rule is not paused, and the rule had no recent local evaluation.
// No-op otherwise.
func (w *LogzioTargetedWarm) WarmRuleIfNeeded(ctx context.Context, rule *ngModels.AlertRule) {
	if !w.enabled || rule.IsPaused {
		return
	}
	if w.manager.clock.Now().Sub(w.manager.logzioObserver.lastRuleActivity(rule.GetKey())) <= TargetedWarmReloadAfter {
		return
	}
	w.warmRule(ctx, rule)
}

// warmRule replaces the cached states of one rule with what is persisted in the database. It is
// the per-rule counterpart of Warm. On a database error the cache is left untouched.
func (w *LogzioTargetedWarm) warmRule(ctx context.Context, rule *ngModels.AlertRule) {
	if w.manager.instanceStore == nil {
		w.manager.log.Info("Skip warming the rule state because instance store is not configured")
		return
	}
	logger := w.manager.log.FromContext(ctx)
	startTime := time.Now()

	cmd := ngModels.ListAlertInstancesQuery{
		RuleOrgID: rule.OrgID,
		RuleUID:   rule.UID,
	}
	alertInstances, err := w.manager.instanceStore.ListAlertInstances(ctx, &cmd)
	if err != nil {
		logger.Error("Unable to fetch the persisted states of the rule. Skip warming its state", "error", err, "rule_uid", rule.UID, "org_id", rule.OrgID)
		return
	}

	states := &ruleStates{states: make(map[string]*State, len(alertInstances))}
	for _, entry := range alertInstances {
		states.states[entryCacheID(w.manager, entry)] = entryToState(w.manager, entry, rule.Annotations)
	}
	w.manager.cache.setRuleStates(rule.OrgID, rule.UID, states)
	logger.Debug("Rule state cache has been warmed", "rule_uid", rule.UID, "org_id", rule.OrgID, "states", len(alertInstances), "duration", time.Since(startTime))
}

// sweepIdleRuleStates frees the in-memory states of rules that were not evaluated on this pod for
// TargetedWarmEvictAfter. Runs once per tick instead of the old full reload.
func (w *LogzioTargetedWarm) sweepIdleRuleStates() {
	cutoff := w.manager.clock.Now().Add(-TargetedWarmEvictAfter)

	evictedRules := 0
	evictedStates := 0
	for _, key := range w.manager.cache.ruleKeys() {
		if w.manager.logzioObserver.lastRuleActivity(key).After(cutoff) {
			continue
		}
		evictedStates += len(w.manager.cache.removeByRuleUID(key.OrgID, key.UID))
		evictedRules++
	}
	w.manager.logzioObserver.ruleActivity.prune(cutoff)

	if evictedRules > 0 {
		w.manager.log.Info("Freed cached states of rules not evaluated on this pod", "rules", evictedRules, "states", evictedStates, "idle_threshold", TargetedWarmEvictAfter)
	}
}

// shadowWarmCompare loads the full state snapshot from the database, feeds it to the state cache
// compare, and discards it. It deliberately does not apply anything and does not advance the
// warm-snapshot freshness baseline. Compared to the old full reload it skips the per-org rules
// queries: the compare only looks at locally evaluated rules, so orphaned rows do not matter.
func (w *LogzioTargetedWarm) shadowWarmCompare(ctx context.Context) *stateCacheCompareSummary {
	if w.manager.instanceStore == nil {
		return nil
	}
	startTime := time.Now()

	orgIds, err := w.manager.instanceStore.FetchOrgIds(ctx)
	if err != nil {
		w.manager.log.Error("Shadow warm compare: unable to fetch orgIds", "error", err)
		return nil
	}

	snapshot := make(map[int64]map[string]*ruleStates, len(orgIds))
	for _, orgId := range orgIds {
		cmd := ngModels.ListAlertInstancesQuery{
			RuleOrgID: orgId,
		}
		alertInstances, err := w.manager.instanceStore.ListAlertInstances(ctx, &cmd)
		if err != nil {
			w.manager.log.Error("Shadow warm compare: unable to fetch alert instances", "error", err, "org_id", orgId)
			continue
		}
		orgStates := make(map[string]*ruleStates)
		snapshot[orgId] = orgStates
		for _, entry := range alertInstances {
			rs, ok := orgStates[entry.RuleUID]
			if !ok {
				rs = &ruleStates{states: make(map[string]*State)}
				orgStates[entry.RuleUID] = rs
			}
			rs.states[entryCacheID(w.manager, entry)] = entryToState(w.manager, entry, nil)
		}
	}

	summary := w.manager.logzioObserver.compareSnapshotWithCache(snapshot)
	w.manager.log.Debug("Shadow warm compare finished", "duration", time.Since(startTime))
	return summary
}

// entryCacheID computes the cache key of a persisted alert instance, mirroring Warm.
func entryCacheID(st *Manager, entry *ngModels.AlertInstance) string {
	cacheID, err := entry.Labels.StringKey()
	if err != nil {
		st.log.Error("Error getting cacheId for entry", "error", err)
	}
	return cacheID
}

// entryToState converts a persisted alert instance into a cache State, mirroring Warm.
func entryToState(st *Manager, entry *ngModels.AlertInstance, annotations map[string]string) *State {
	var resultFp data.Fingerprint
	if entry.ResultFingerprint != "" {
		fp, err := strconv.ParseUint(entry.ResultFingerprint, 16, 64)
		if err != nil {
			st.log.Error("Failed to parse result fingerprint of alert instance", "error", err, "ruleUID", entry.RuleUID)
		}
		resultFp = data.Fingerprint(fp)
	}
	return &State{
		AlertRuleUID:         entry.RuleUID,
		OrgID:                entry.RuleOrgID,
		CacheID:              entryCacheID(st, entry),
		Labels:               map[string]string(entry.Labels),
		State:                translateInstanceState(entry.CurrentState),
		StateReason:          entry.CurrentReason,
		LastEvaluationString: "",
		StartsAt:             entry.CurrentStateSince,
		EndsAt:               entry.CurrentStateEnd,
		LastEvaluationTime:   entry.LastEvalTime,
		Annotations:          annotations,
		ResultFingerprint:    resultFp,
	}
}

// setRuleStates replaces the cached states of a single rule.
func (c *cache) setRuleStates(orgID int64, alertRuleUID string, states *ruleStates) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	orgStates, ok := c.states[orgID]
	if !ok {
		orgStates = make(map[string]*ruleStates)
		c.states[orgID] = orgStates
	}
	orgStates[alertRuleUID] = states
}

// ruleKeys returns the keys of all rules that currently have an entry in the cache.
func (c *cache) ruleKeys() []ngModels.AlertRuleKey {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	keys := make([]ngModels.AlertRuleKey, 0, len(c.states))
	for orgID, orgStates := range c.states {
		for uid := range orgStates {
			keys = append(keys, ngModels.AlertRuleKey{OrgID: orgID, UID: uid})
		}
	}
	return keys
}

// LOGZ.IO GRAFANA CHANGE :: End
