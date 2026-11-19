package state

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// DefaultRecordingSeriesSaveInterval is the shortest time between two saves of one rule in write-through mode.
// A save writes the whole rule, so a rule that changes every tick would otherwise rewrite its row every tick.
// A crash loses at most this much, and a marker only matters within the lookback of the target anyway.
const DefaultRecordingSeriesSaveInterval = time.Minute

// warnInterval limits how often one rule logs the same warning.
const warnInterval = 5 * time.Minute

// RecordingSeriesCfg configures the tracking of series written by recording rules.
type RecordingSeriesCfg struct {
	// Enabled turns on Warm, the series provider and the tracker.
	Enabled bool
	// WriteThrough saves a rule's series on Persist. Leave it off when the periodic full sync persists them.
	WriteThrough bool
	// SaveInterval is the shortest time between two write-through saves of a rule. 0 uses the default.
	SaveInterval time.Duration
	// Budget limits the series tracked across all rules. Nil means unlimited.
	Budget *SeriesBudget
	// Metrics is where the tracker reports. Nil reports nothing.
	Metrics *metrics.Scheduler
}

// SeriesTarget is where a recording rule writes.
type SeriesTarget struct {
	DatasourceUID string
	Metric        string
}

// StaleSeries is a series that needs a stale marker.
type StaleSeries struct {
	Target SeriesTarget
	Labels data.Labels
}

// RecordingSeriesManager remembers the series recording rules wrote.
// Entries live in caches of their own, so they never show up as alert state.
type RecordingSeriesManager struct {
	log       log.Logger
	clock     clock.Clock
	metrics   *metrics.Scheduler
	readiness ReadinessProbe
	store     RecordingSeriesStore
	cfg       RecordingSeriesCfg

	// mtx guards only the map. Each rule has its own lock, so rules do not wait for each other.
	mtx     sync.RWMutex
	rules   map[models.AlertRuleKey]*trackedRule
	tracked atomic.Int64
}

type trackedRule struct {
	mtx sync.Mutex
	// removed is set once the rule left the map, so a caller that was waiting for the lock starts over.
	removed bool
	caches  map[SeriesTarget]*cache
	// dirty means the stored series differ from the tracked ones.
	dirty    bool
	lastSave time.Time

	lastBudgetWarn time.Time
}

func newTrackedRule() *trackedRule {
	return &trackedRule{caches: make(map[SeriesTarget]*cache, 1)}
}

func newRecordingSeriesManager(cfg RecordingSeriesCfg, store RecordingSeriesStore, readiness ReadinessProbe, clk clock.Clock, logger log.Logger) *RecordingSeriesManager {
	if cfg.SaveInterval <= 0 {
		cfg.SaveInterval = DefaultRecordingSeriesSaveInterval
	}
	if clk == nil {
		clk = clock.New()
	}
	return &RecordingSeriesManager{
		log:       logger,
		clock:     clk,
		metrics:   cfg.Metrics,
		readiness: readiness,
		store:     store,
		cfg:       cfg,
		rules:     make(map[models.AlertRuleKey]*trackedRule),
	}
}

// Ready reports whether the state cache has been warmed.
func (m *RecordingSeriesManager) Ready() Readiness {
	return m.readiness.Ready()
}

// Track records the series a rule output at a tick and returns the ones that went missing.
// The manager keeps the label maps, so callers must not change them afterwards.
// The returned series are no longer tracked: write their markers. A marker that fails is not retried.
func (m *RecordingSeriesManager) Track(rule *models.AlertRule, target SeriesTarget, at time.Time, series []data.Labels) []StaleSeries {
	key := rule.GetKey()
	tr := m.lockRule(key)
	defer tr.mtx.Unlock()
	c := tr.cache(target)

	// An entry whose time is the tick was output in it. Counting them avoids a set per tick.
	seen := 0
	untracked := 0
	for _, labels := range series {
		fp := labels.Fingerprint()
		if e := c.get(key.OrgID, key.UID, fp); e != nil {
			if !e.LastEvaluationTime.Equal(at) {
				e.LastEvaluationTime = at
				seen++
			}
			continue
		}
		if !m.admit() {
			untracked++
			continue
		}
		c.set(newSeriesState(key, fp, labels, at))
		m.countTracked(1)
		tr.dirty = true
		seen++
	}
	if untracked > 0 {
		m.reportUntracked(key, tr, untracked)
	}

	stale := m.takeMissing(rule, c, target, at, seen)
	stale = append(stale, m.takeOtherTargets(tr, key, target, c, at)...)
	if len(stale) > 0 {
		tr.dirty = true
	}
	return stale
}

// StaleAll returns every tracked series of the rule and stops tracking them.
// Unlike Track it does not wait for the interval, as a paused rule has no next evaluation.
func (m *RecordingSeriesManager) StaleAll(key models.AlertRuleKey) []StaleSeries {
	tr := m.lockExisting(key)
	if tr == nil {
		return nil
	}
	defer tr.mtx.Unlock()

	var stale []StaleSeries
	for target, c := range tr.caches {
		stale = append(stale, drain(key, target, c)...)
		delete(tr.caches, target)
	}
	if len(stale) > 0 {
		tr.dirty = true
	}
	m.release(len(stale))
	return stale
}

// Forget stops tracking the rule in memory only. Use it when the rule moves to another instance.
// Flush first if the new instance should find the latest series in the store.
func (m *RecordingSeriesManager) Forget(key models.AlertRuleKey) {
	m.remove(key)
}

// Delete stops tracking the rule and removes its stored series.
func (m *RecordingSeriesManager) Delete(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	m.remove(key.AlertRuleKey)
	if m.store == nil {
		return nil
	}
	return m.store.DeleteRecordingSeriesForRule(ctx, key)
}

// Persist saves the series of the rule if they changed and the last save is older than the save interval.
// A rule that changes on almost every tick would otherwise rewrite its whole row each time.
// Call it at the end of a tick, after the markers were written and the failed ones retained.
// It does nothing unless write-through is on, as the periodic full sync saves them otherwise.
func (m *RecordingSeriesManager) Persist(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	return m.save(ctx, key, false)
}

// Flush saves the series of the rule if they changed, whatever the save interval.
// Call it when the rule stops and keeps its stored series.
func (m *RecordingSeriesManager) Flush(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	return m.save(ctx, key, true)
}

func (m *RecordingSeriesManager) save(ctx context.Context, key models.AlertRuleKeyWithGroup, force bool) error {
	if m.store == nil || !m.cfg.WriteThrough {
		return nil
	}
	tr := m.lockExisting(key.AlertRuleKey)
	if tr == nil {
		return nil
	}
	now := m.clock.Now()
	if !tr.dirty || (!force && !tr.lastSave.IsZero() && now.Sub(tr.lastSave) < m.cfg.SaveInterval) {
		tr.mtx.Unlock()
		return nil
	}
	series := m.seriesOf(key.AlertRuleKey, tr)
	tr.dirty = false
	tr.lastSave = now
	tr.mtx.Unlock()

	if err := m.store.SaveRecordingSeriesForRule(ctx, key, series); err != nil {
		tr.mtx.Lock()
		tr.dirty = true
		tr.mtx.Unlock()
		return err
	}
	return nil
}

// GetRecordingSeries returns the tracked series by rule, for the periodic full sync.
func (m *RecordingSeriesManager) GetRecordingSeries() map[models.AlertRuleKey][]models.RecordingSeries {
	type ruleRef struct {
		key models.AlertRuleKey
		tr  *trackedRule
	}
	m.mtx.RLock()
	refs := make([]ruleRef, 0, len(m.rules))
	for key, tr := range m.rules {
		refs = append(refs, ruleRef{key, tr})
	}
	m.mtx.RUnlock()

	out := make(map[models.AlertRuleKey][]models.RecordingSeries, len(refs))
	for _, ref := range refs {
		ref.tr.mtx.Lock()
		var series []models.RecordingSeries
		if !ref.tr.removed {
			series = m.seriesOf(ref.key, ref.tr)
		}
		ref.tr.mtx.Unlock()
		if len(series) > 0 {
			out[ref.key] = series
		}
	}
	return out
}

// Tracked is the number of series currently tracked.
func (m *RecordingSeriesManager) Tracked() int64 {
	return m.tracked.Load()
}

// reset forgets every rule and gives their room back to the budget.
func (m *RecordingSeriesManager) reset() {
	m.mtx.Lock()
	old := m.rules
	m.rules = make(map[models.AlertRuleKey]*trackedRule)
	m.mtx.Unlock()

	for key, tr := range old {
		m.discard(key, tr)
	}
}

// warm loads the stored series of an org. Rules that already evaluated keep what they track.
func (m *RecordingSeriesManager) warm(ctx context.Context, orgID int64, rules map[string]*models.AlertRule, logger log.Logger) (int, bool) {
	if m.store == nil {
		return 0, true
	}
	stored, err := m.store.ListRecordingSeries(ctx, orgID)
	if err != nil {
		logger.Error("Unable to fetch the stored recording rule series, continuing without them", "org_id", orgID, "error", err)
		return 0, false
	}

	loaded, dropped := 0, 0
	for uid, series := range stored {
		rule, ok := rules[uid]
		if !ok || rule.Type() != models.RuleTypeRecording {
			continue
		}
		key := rule.GetKey()

		tr := newTrackedRule()
		tr.mtx.Lock()
		m.mtx.Lock()
		if _, live := m.rules[key]; live {
			m.mtx.Unlock()
			tr.mtx.Unlock()
			continue
		}
		m.rules[key] = tr
		m.mtx.Unlock()

		for _, s := range series {
			if !m.admit() {
				dropped++
				continue
			}
			fp := s.Labels.Fingerprint()
			tr.cache(SeriesTarget{DatasourceUID: s.TargetDatasourceUID, Metric: s.Metric}).
				set(newSeriesState(key, fp, s.Labels, s.LastUpdate))
			m.countTracked(1)
			loaded++
		}
		tr.mtx.Unlock()
	}
	if dropped > 0 {
		logger.Warn("The recording series budget was reached while loading stored series", "org_id", orgID, "dropped", dropped)
		m.countUntracked(dropped)
	}
	return loaded, true
}

// lockRule returns the rule locked, creating it if needed.
func (m *RecordingSeriesManager) lockRule(key models.AlertRuleKey) *trackedRule {
	for {
		m.mtx.RLock()
		tr, ok := m.rules[key]
		m.mtx.RUnlock()
		if !ok {
			m.mtx.Lock()
			if tr, ok = m.rules[key]; !ok {
				tr = newTrackedRule()
				m.rules[key] = tr
			}
			m.mtx.Unlock()
		}
		tr.mtx.Lock()
		if !tr.removed {
			return tr
		}
		tr.mtx.Unlock()
	}
}

// lockExisting returns the rule locked, or nil if it is not tracked.
func (m *RecordingSeriesManager) lockExisting(key models.AlertRuleKey) *trackedRule {
	for {
		m.mtx.RLock()
		tr, ok := m.rules[key]
		m.mtx.RUnlock()
		if !ok {
			return nil
		}
		tr.mtx.Lock()
		if !tr.removed {
			return tr
		}
		tr.mtx.Unlock()
	}
}

func (tr *trackedRule) cache(target SeriesTarget) *cache {
	c, ok := tr.caches[target]
	if !ok {
		c = newCache()
		tr.caches[target] = c
	}
	return c
}

// remove takes the rule out of the map and gives its room back to the budget.
func (m *RecordingSeriesManager) remove(key models.AlertRuleKey) {
	m.mtx.Lock()
	tr, ok := m.rules[key]
	delete(m.rules, key)
	m.mtx.Unlock()
	if !ok {
		return
	}
	m.discard(key, tr)
}

// discard empties a rule that is no longer in the map. It waits for a caller that still holds the rule.
func (m *RecordingSeriesManager) discard(key models.AlertRuleKey, tr *trackedRule) {
	tr.mtx.Lock()
	defer tr.mtx.Unlock()
	for _, c := range tr.caches {
		m.release(c.ruleStateCount(key.OrgID, key.UID))
	}
	tr.caches = nil
	tr.removed = true
}

// admit reports whether a new series may be tracked.
func (m *RecordingSeriesManager) admit() bool {
	return m.cfg.Budget.Admit()
}

// release stops counting n series that are no longer tracked.
func (m *RecordingSeriesManager) release(n int) {
	m.tracked.Add(-int64(n))
	m.cfg.Budget.Release(n)
	if m.metrics != nil {
		m.metrics.RecordingRuleTrackedSeries.Sub(float64(n))
	}
}

// takeMissing runs the missing series pass on the cache of the target and returns the series it staled.
func (m *RecordingSeriesManager) takeMissing(rule *models.AlertRule, c *cache, target SeriesTarget, at time.Time, seen int) []StaleSeries {
	key := rule.GetKey()
	if c.ruleStateCount(key.OrgID, key.UID) == seen {
		return nil
	}

	// A marker one evaluation late would outlive the series, so every missing series is stale at once.
	one := int64(1)
	passRule := *rule
	passRule.MissingSeriesEvalsToResolve = &one
	transitions, _ := processMissingSeriesStates(c, log.NewNopLogger(), at, &passRule, nil)

	var stale []StaleSeries
	for _, t := range transitions {
		if t.StateReason != models.StateReasonMissingSeries {
			continue
		}
		stale = append(stale, StaleSeries{Target: target, Labels: t.Labels})
	}
	m.release(len(stale))
	return stale
}

// takeOtherTargets stales what the rule tracked under a target it no longer writes to.
// A series that is still output under the same metric is live, so no marker would be right for it.
func (m *RecordingSeriesManager) takeOtherTargets(tr *trackedRule, key models.AlertRuleKey, current SeriesTarget, currentCache *cache, at time.Time) []StaleSeries {
	var stale []StaleSeries
	for target, c := range tr.caches {
		if target == current {
			continue
		}
		for _, s := range drain(key, target, c) {
			m.release(1)
			if target.Metric == current.Metric && outputAt(currentCache, key, s.Labels.Fingerprint(), at) {
				continue
			}
			stale = append(stale, s)
		}
		delete(tr.caches, target)
	}
	return stale
}

func (m *RecordingSeriesManager) seriesOf(key models.AlertRuleKey, tr *trackedRule) []models.RecordingSeries {
	var out []models.RecordingSeries
	for target, c := range tr.caches {
		for _, s := range c.getStatesForRuleUID(key.OrgID, key.UID) {
			out = append(out, models.RecordingSeries{
				TargetDatasourceUID: target.DatasourceUID,
				Metric:              target.Metric,
				Labels:              s.Labels,
				LastUpdate:          s.LastEvaluationTime,
			})
		}
	}
	return out
}

func (m *RecordingSeriesManager) reportUntracked(key models.AlertRuleKey, tr *trackedRule, n int) {
	m.countUntracked(n)
	now := m.clock.Now()
	if now.Sub(tr.lastBudgetWarn) < warnInterval {
		return
	}
	tr.lastBudgetWarn = now
	m.log.Warn("The recording series budget is reached, new series get no stale marker", "org_id", key.OrgID, "rule_uid", key.UID, "untracked", n)
}

func (m *RecordingSeriesManager) countUntracked(n int) {
	if m.metrics != nil {
		m.metrics.RecordingRuleUntrackedSeries.Add(float64(n))
	}
}

// countTracked counts n series admitted by the budget. The gauge is moved by the change, as the
// recording rule does, so it stays right when both count into it.
func (m *RecordingSeriesManager) countTracked(n int) {
	m.tracked.Add(int64(n))
	if m.metrics != nil {
		m.metrics.RecordingRuleTrackedSeries.Add(float64(n))
	}
}

func newSeriesState(key models.AlertRuleKey, fp data.Fingerprint, labels data.Labels, lastWritten time.Time) *State {
	return &State{
		OrgID:              key.OrgID,
		AlertRuleUID:       key.UID,
		CacheID:            fp,
		State:              eval.Normal,
		Labels:             labels,
		LastEvaluationTime: lastWritten,
	}
}

// drain returns every series of the cache and empties it.
func drain(key models.AlertRuleKey, target SeriesTarget, c *cache) []StaleSeries {
	states := c.getStatesForRuleUID(key.OrgID, key.UID)
	out := make([]StaleSeries, 0, len(states))
	for _, s := range states {
		out = append(out, StaleSeries{Target: target, Labels: s.Labels})
	}
	c.reset()
	return out
}

// outputAt reports whether the series was output in the tick.
func outputAt(c *cache, key models.AlertRuleKey, fp data.Fingerprint, at time.Time) bool {
	e := c.get(key.OrgID, key.UID, fp)
	return e != nil && e.LastEvaluationTime.Equal(at)
}

// ruleStateCount is the number of states of the rule.
func (c *cache) ruleStateCount(orgID int64, alertRuleUID string) int {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	if rs, ok := c.states[orgID][alertRuleUID]; ok {
		return len(rs.states)
	}
	return 0
}

// seriesAwareProvider lets the persister write the series along with the alert instances.
type seriesAwareProvider struct {
	AlertInstancesProvider
	series *RecordingSeriesManager
}

func (p seriesAwareProvider) GetRecordingSeries() map[models.AlertRuleKey][]models.RecordingSeries {
	return p.series.GetRecordingSeries()
}
