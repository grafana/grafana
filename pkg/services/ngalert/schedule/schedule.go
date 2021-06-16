package schedule

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/benbjohnson/clock"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/tsdb"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

// ScheduleService handles scheduling
type ScheduleService interface {
	Ticker(context.Context, *state.Manager) error
	Pause() error
	Unpause() error
	WarmStateCache(*state.Manager)

	// the following are used by tests only used for tests
	evalApplied(models.AlertRuleKey, time.Time)
	stopApplied(models.AlertRuleKey)
	overrideCfg(cfg SchedulerCfg)
}

func (sch *schedule) ruleRoutine(grafanaCtx context.Context, key models.AlertRuleKey, evalCh <-chan *evalContext, stopCh <-chan struct{}, stateManager *state.Manager) error {
	sch.log.Debug("alert rule routine started", "key", key)

	evalRunning := false
	var attempt int64
	var alertRule *models.AlertRule
	for {
		select {
		case ctx := <-evalCh:
			if evalRunning {
				continue
			}

			evaluate := func(attempt int64) error {
				start := timeNow()

				// fetch latest alert rule version
				if alertRule == nil || alertRule.Version < ctx.version {
					q := models.GetAlertRuleByUIDQuery{OrgID: key.OrgID, UID: key.UID}
					err := sch.ruleStore.GetAlertRuleByUID(&q)
					if err != nil {
						sch.log.Error("failed to fetch alert rule", "key", key)
						return err
					}
					alertRule = q.Result
					sch.log.Debug("new alert rule version fetched", "title", alertRule.Title, "key", key, "version", alertRule.Version)
				}

				condition := models.Condition{
					Condition: alertRule.Condition,
					OrgID:     alertRule.OrgID,
					Data:      alertRule.Data,
				}
				results, err := sch.evaluator.ConditionEval(&condition, ctx.now, sch.dataService)
				var (
					end    = timeNow()
					tenant = fmt.Sprint(alertRule.OrgID)
					dur    = end.Sub(start).Seconds()
				)

				sch.metrics.EvalTotal.WithLabelValues(tenant).Inc()
				sch.metrics.EvalDuration.WithLabelValues(tenant).Observe(dur)
				if err != nil {
					sch.metrics.EvalFailures.WithLabelValues(tenant).Inc()
					// consider saving alert instance on error
					sch.log.Error("failed to evaluate alert rule", "title", alertRule.Title,
						"key", key, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "error", err)
					return err
				}

				processedStates := stateManager.ProcessEvalResults(alertRule, results)
				sch.saveAlertStates(processedStates)
				alerts := FromAlertStateToPostableAlerts(sch.log, processedStates, stateManager, sch.appURL)
				sch.log.Debug("sending alerts to notifier", "count", len(alerts.PostableAlerts), "alerts", alerts.PostableAlerts)
				err = sch.sendAlerts(alerts)
				if err != nil {
					sch.log.Error("failed to put alerts in the notifier", "count", len(alerts.PostableAlerts), "err", err)
				}
				return nil
			}

			func() {
				evalRunning = true
				defer func() {
					evalRunning = false
					sch.evalApplied(key, ctx.now)
				}()

				for attempt = 0; attempt < sch.maxAttempts; attempt++ {
					err := evaluate(attempt)
					if err == nil {
						break
					}
				}
			}()
		case <-stopCh:
			sch.stopApplied(key)
			sch.log.Debug("stopping alert rule routine", "key", key)
			// interrupt evaluation if it's running
			return nil
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
		}
	}
}

// Notifier handles the delivery of alert notifications to the end user
type Notifier interface {
	PutAlerts(alerts apimodels.PostableAlerts) error
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert rule gets its own channel and routine
	registry alertRuleRegistry

	maxAttempts int64

	clock clock.Clock

	heartbeat *alerting.Ticker

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalAppliedFunc func(models.AlertRuleKey, time.Time)

	// stopApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from stopApplied is handled.
	stopAppliedFunc func(models.AlertRuleKey)

	log log.Logger

	evaluator eval.Evaluator

	ruleStore store.RuleStore

	instanceStore store.InstanceStore

	dataService *tsdb.Service

	appURL string

	notifier Notifier
	metrics  *metrics.Metrics
}

// SchedulerCfg is the scheduler configuration.
type SchedulerCfg struct {
	C               clock.Clock
	BaseInterval    time.Duration
	Logger          log.Logger
	EvalAppliedFunc func(models.AlertRuleKey, time.Time)
	MaxAttempts     int64
	StopAppliedFunc func(models.AlertRuleKey)
	Evaluator       eval.Evaluator
	RuleStore       store.RuleStore
	InstanceStore   store.InstanceStore
	Notifier        Notifier
	Metrics         *metrics.Metrics
}

// NewScheduler returns a new schedule.
func NewScheduler(cfg SchedulerCfg, dataService *tsdb.Service, appURL string) *schedule {
	ticker := alerting.NewTicker(cfg.C.Now(), time.Second*0, cfg.C, int64(cfg.BaseInterval.Seconds()))
	sch := schedule{
		registry:        alertRuleRegistry{alertRuleInfo: make(map[models.AlertRuleKey]alertRuleInfo)},
		maxAttempts:     cfg.MaxAttempts,
		clock:           cfg.C,
		baseInterval:    cfg.BaseInterval,
		log:             cfg.Logger,
		heartbeat:       ticker,
		evalAppliedFunc: cfg.EvalAppliedFunc,
		stopAppliedFunc: cfg.StopAppliedFunc,
		evaluator:       cfg.Evaluator,
		ruleStore:       cfg.RuleStore,
		instanceStore:   cfg.InstanceStore,
		dataService:     dataService,
		notifier:        cfg.Notifier,
		metrics:         cfg.Metrics,
		appURL:          appURL,
	}
	return &sch
}

func (sch *schedule) overrideCfg(cfg SchedulerCfg) {
	sch.clock = cfg.C
	sch.baseInterval = cfg.BaseInterval
	sch.heartbeat = alerting.NewTicker(cfg.C.Now(), time.Second*0, cfg.C, int64(cfg.BaseInterval.Seconds()))
	sch.evalAppliedFunc = cfg.EvalAppliedFunc
	sch.stopAppliedFunc = cfg.StopAppliedFunc
}

func (sch *schedule) evalApplied(alertDefKey models.AlertRuleKey, now time.Time) {
	if sch.evalAppliedFunc == nil {
		return
	}

	sch.evalAppliedFunc(alertDefKey, now)
}

func (sch *schedule) stopApplied(alertDefKey models.AlertRuleKey) {
	if sch.stopAppliedFunc == nil {
		return
	}

	sch.stopAppliedFunc(alertDefKey)
}

func (sch *schedule) Pause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Pause()
	sch.log.Info("alert rule scheduler paused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Unpause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Unpause()
	sch.log.Info("alert rule scheduler unpaused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Ticker(grafanaCtx context.Context, stateManager *state.Manager) error {
	dispatcherGroup, ctx := errgroup.WithContext(grafanaCtx)
	for {
		select {
		case tick := <-sch.heartbeat.C:
			tickNum := tick.Unix() / int64(sch.baseInterval.Seconds())
			alertRules := sch.fetchAllDetails()
			sch.log.Debug("alert rules fetched", "count", len(alertRules))

			// registeredDefinitions is a map used for finding deleted alert rules
			// initially it is assigned to all known alert rules from the previous cycle
			// each alert rule found also in this cycle is removed
			// so, at the end, the remaining registered alert rules are the deleted ones
			registeredDefinitions := sch.registry.keyMap()

			type readyToRunItem struct {
				key      models.AlertRuleKey
				ruleInfo alertRuleInfo
			}
			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertRules {
				key := item.GetKey()
				itemVersion := item.Version
				newRoutine := !sch.registry.exists(key)
				ruleInfo := sch.registry.getOrCreateInfo(key, itemVersion)
				invalidInterval := item.IntervalSeconds%int64(sch.baseInterval.Seconds()) != 0

				if newRoutine && !invalidInterval {
					dispatcherGroup.Go(func() error {
						return sch.ruleRoutine(ctx, key, ruleInfo.evalCh, ruleInfo.stopCh, stateManager)
					})
				}

				if invalidInterval {
					// this is expected to be always false
					// give that we validate interval during alert rule updates
					sch.log.Debug("alert rule with invalid interval will be ignored: interval should be divided exactly by scheduler interval", "key", key, "interval", time.Duration(item.IntervalSeconds)*time.Second, "scheduler interval", sch.baseInterval)
					continue
				}

				itemFrequency := item.IntervalSeconds / int64(sch.baseInterval.Seconds())
				if item.IntervalSeconds != 0 && tickNum%itemFrequency == 0 {
					readyToRun = append(readyToRun, readyToRunItem{key: key, ruleInfo: ruleInfo})
				}

				// remove the alert rule from the registered alert rules
				delete(registeredDefinitions, key)
			}

			var step int64 = 0
			if len(readyToRun) > 0 {
				step = sch.baseInterval.Nanoseconds() / int64(len(readyToRun))
			}

			for i := range readyToRun {
				item := readyToRun[i]

				time.AfterFunc(time.Duration(int64(i)*step), func() {
					item.ruleInfo.evalCh <- &evalContext{now: tick, version: item.ruleInfo.version}
				})
			}

			// unregister and stop routines of the deleted alert rules
			for key := range registeredDefinitions {
				ruleInfo, err := sch.registry.get(key)
				if err != nil {
					sch.log.Error("failed to get alert rule routine information", "err", err)
					continue
				}
				ruleInfo.stopCh <- struct{}{}
				sch.registry.del(key)
			}
		case <-grafanaCtx.Done():
			waitErr := dispatcherGroup.Wait()

			orgIds, err := sch.instanceStore.FetchOrgIds()
			if err != nil {
				sch.log.Error("unable to fetch orgIds", "msg", err.Error())
			}

			for _, v := range orgIds {
				sch.saveAlertStates(stateManager.GetAll(v))
			}

			stateManager.Close()
			return waitErr
		}
	}
}

func (sch *schedule) sendAlerts(alerts apimodels.PostableAlerts) error {
	return sch.notifier.PutAlerts(alerts)
}

func (sch *schedule) saveAlertStates(states []*state.State) {
	sch.log.Debug("saving alert states", "count", len(states))
	for _, s := range states {
		cmd := models.SaveAlertInstanceCommand{
			RuleOrgID:         s.OrgID,
			RuleUID:           s.AlertRuleUID,
			Labels:            models.InstanceLabels(s.Labels),
			State:             models.InstanceStateType(s.State.String()),
			LastEvalTime:      s.LastEvaluationTime,
			CurrentStateSince: s.StartsAt,
			CurrentStateEnd:   s.EndsAt,
		}
		err := sch.instanceStore.SaveAlertInstance(&cmd)
		if err != nil {
			sch.log.Error("failed to save alert state", "uid", s.AlertRuleUID, "orgId", s.OrgID, "labels", s.Labels.String(), "state", s.State.String(), "msg", err.Error())
		}
	}
}

func (sch *schedule) WarmStateCache(st *state.Manager) {
	sch.log.Info("warming cache for startup")
	st.ResetCache()

	orgIds, err := sch.instanceStore.FetchOrgIds()
	if err != nil {
		sch.log.Error("unable to fetch orgIds", "msg", err.Error())
	}

	var states []*state.State
	for _, orgId := range orgIds {
		// Get Rules
		ruleCmd := models.ListAlertRulesQuery{
			OrgID: orgId,
		}
		if err := sch.ruleStore.GetOrgAlertRules(&ruleCmd); err != nil {
			sch.log.Error("unable to fetch previous state", "msg", err.Error())
		}

		ruleByUID := make(map[string]*models.AlertRule, len(ruleCmd.Result))
		for _, rule := range ruleCmd.Result {
			ruleByUID[rule.UID] = rule
		}

		// Get Instances
		cmd := models.ListAlertInstancesQuery{
			RuleOrgID: orgId,
		}
		if err := sch.instanceStore.ListAlertInstances(&cmd); err != nil {
			sch.log.Error("unable to fetch previous state", "msg", err.Error())
		}

		for _, entry := range cmd.Result {
			ruleForEntry, ok := ruleByUID[entry.RuleUID]
			if !ok {
				sch.log.Error("rule not found for instance, ignoring", "rule", entry.RuleUID)
				continue
			}

			lbs := map[string]string(entry.Labels)
			cacheId, err := entry.Labels.StringKey()
			if err != nil {
				sch.log.Error("error getting cacheId for entry", "msg", err.Error())
			}
			stateForEntry := &state.State{
				AlertRuleUID:       entry.RuleUID,
				OrgID:              entry.RuleOrgID,
				CacheId:            cacheId,
				Labels:             lbs,
				State:              translateInstanceState(entry.CurrentState),
				Results:            []state.Evaluation{},
				StartsAt:           entry.CurrentStateSince,
				EndsAt:             entry.CurrentStateEnd,
				LastEvaluationTime: entry.LastEvalTime,
				Annotations:        ruleForEntry.Annotations,
			}
			states = append(states, stateForEntry)
		}
	}
	st.Put(states)
}

func translateInstanceState(state models.InstanceStateType) eval.State {
	switch {
	case state == models.InstanceStateFiring:
		return eval.Alerting
	case state == models.InstanceStateNormal:
		return eval.Normal
	default:
		return eval.Error
	}
}

type alertRuleRegistry struct {
	mu            sync.Mutex
	alertRuleInfo map[models.AlertRuleKey]alertRuleInfo
}

// getOrCreateInfo returns the channel for the specific alert rule
// if it does not exists creates one and returns it
func (r *alertRuleRegistry) getOrCreateInfo(key models.AlertRuleKey, ruleVersion int64) alertRuleInfo {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertRuleInfo[key]
	if !ok {
		r.alertRuleInfo[key] = alertRuleInfo{evalCh: make(chan *evalContext), stopCh: make(chan struct{}), version: ruleVersion}
		return r.alertRuleInfo[key]
	}
	info.version = ruleVersion
	r.alertRuleInfo[key] = info
	return info
}

// get returns the channel for the specific alert rule
// if the key does not exist returns an error
func (r *alertRuleRegistry) get(key models.AlertRuleKey) (*alertRuleInfo, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertRuleInfo[key]
	if !ok {
		return nil, fmt.Errorf("%v key not found", key)
	}
	return &info, nil
}

func (r *alertRuleRegistry) exists(key models.AlertRuleKey) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.alertRuleInfo[key]
	return ok
}

func (r *alertRuleRegistry) del(key models.AlertRuleKey) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.alertRuleInfo, key)
}

func (r *alertRuleRegistry) iter() <-chan models.AlertRuleKey {
	c := make(chan models.AlertRuleKey)

	f := func() {
		r.mu.Lock()
		defer r.mu.Unlock()

		for k := range r.alertRuleInfo {
			c <- k
		}
		close(c)
	}
	go f()

	return c
}

func (r *alertRuleRegistry) keyMap() map[models.AlertRuleKey]struct{} {
	definitionsIDs := make(map[models.AlertRuleKey]struct{})
	for k := range r.iter() {
		definitionsIDs[k] = struct{}{}
	}
	return definitionsIDs
}

type alertRuleInfo struct {
	evalCh  chan *evalContext
	stopCh  chan struct{}
	version int64
}

type evalContext struct {
	now     time.Time
	version int64
}
