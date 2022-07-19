package schedule

import (
	"context"
	"fmt"
	"net/url"
	"time"

	prometheusModel "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"
)

// ScheduleService is an interface for a service that schedules the evaluation
// of alert rules.
//go:generate mockery --name ScheduleService --structname FakeScheduleService --inpackage --filename schedule_mock.go
type ScheduleService interface {
	// Run the scheduler until the context is canceled or the scheduler returns
	// an error. The scheduler is terminated when this function returns.
	Run(context.Context) error
	// UpdateAlertRule notifies scheduler that a rule has been changed
	UpdateAlertRule(key ngmodels.AlertRuleKey, lastVersion int64)
	// UpdateAlertRulesByNamespaceUID notifies scheduler that all rules in a namespace should be updated.
	UpdateAlertRulesByNamespaceUID(ctx context.Context, orgID int64, uid string) error
	// DeleteAlertRule notifies scheduler that a rule has been changed
	DeleteAlertRule(key ngmodels.AlertRuleKey)
	// the following are used by tests only used for tests
	evalApplied(ngmodels.AlertRuleKey, time.Time)
	stopApplied(ngmodels.AlertRuleKey)
	overrideCfg(cfg SchedulerCfg)

	folderUpdateHandler(ctx context.Context, evt *events.FolderUpdated) error
}

//go:generate mockery --name AlertsSender --structname AlertsSenderMock --inpackage --filename alerts_sender_mock.go --with-expecter
// AlertsSender is an interface for a service that is responsible for sending notifications to the end-user.
type AlertsSender interface {
	Send(key ngmodels.AlertRuleKey, alerts definitions.PostableAlerts)
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert rule gets its own channel and routine
	registry alertRuleInfoRegistry

	maxAttempts int64

	clock clock.Clock

	ticker *alerting.Ticker

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalAppliedFunc func(ngmodels.AlertRuleKey, time.Time)

	// stopApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from stopApplied is handled.
	stopAppliedFunc func(ngmodels.AlertRuleKey)

	log log.Logger

	evaluator eval.Evaluator

	ruleStore     store.RuleStore
	instanceStore store.InstanceStore

	stateManager *state.Manager

	appURL               *url.URL
	disableGrafanaFolder bool

	metrics *metrics.Scheduler

	alertsSender    AlertsSender
	minRuleInterval time.Duration

	// schedulableAlertRules contains the alert rules that are considered for
	// evaluation in the current tick. The evaluation of an alert rule in the
	// current tick depends on its evaluation interval and when it was
	// last evaluated.
	schedulableAlertRules schedulableAlertRulesRegistry

	// bus is used to hook into events that should cause rule updates.
	bus bus.Bus
}

// SchedulerCfg is the scheduler configuration.
type SchedulerCfg struct {
	Cfg             setting.UnifiedAlertingSettings
	C               clock.Clock
	Logger          log.Logger
	EvalAppliedFunc func(ngmodels.AlertRuleKey, time.Time)
	StopAppliedFunc func(ngmodels.AlertRuleKey)
	Evaluator       eval.Evaluator
	RuleStore       store.RuleStore
	InstanceStore   store.InstanceStore
	Metrics         *metrics.Scheduler
	AlertSender     AlertsSender
}

// NewScheduler returns a new schedule.
func NewScheduler(cfg SchedulerCfg, appURL *url.URL, stateManager *state.Manager, bus bus.Bus) *schedule {
	ticker := alerting.NewTicker(cfg.C, cfg.Cfg.BaseInterval, cfg.Metrics.Ticker)

	sch := schedule{
		registry:              alertRuleInfoRegistry{alertRuleInfo: make(map[ngmodels.AlertRuleKey]*alertRuleInfo)},
		maxAttempts:           cfg.Cfg.MaxAttempts,
		clock:                 cfg.C,
		baseInterval:          cfg.Cfg.BaseInterval,
		log:                   cfg.Logger,
		ticker:                ticker,
		evalAppliedFunc:       cfg.EvalAppliedFunc,
		stopAppliedFunc:       cfg.StopAppliedFunc,
		evaluator:             cfg.Evaluator,
		ruleStore:             cfg.RuleStore,
		instanceStore:         cfg.InstanceStore,
		metrics:               cfg.Metrics,
		appURL:                appURL,
		disableGrafanaFolder:  cfg.Cfg.ReservedLabels.IsReservedLabelDisabled(ngmodels.FolderTitleLabel),
		stateManager:          stateManager,
		minRuleInterval:       cfg.Cfg.MinInterval,
		schedulableAlertRules: schedulableAlertRulesRegistry{rules: make(map[ngmodels.AlertRuleKey]*ngmodels.SchedulableAlertRule)},
		bus:                   bus,
		alertsSender:          cfg.AlertSender,
	}

	bus.AddEventListener(sch.folderUpdateHandler)

	return &sch
}

func (sch *schedule) Run(ctx context.Context) error {
	defer sch.ticker.Stop()

	if err := sch.schedulePeriodic(ctx); err != nil {
		sch.log.Error("failure while running the rule evaluation loop", "err", err)
	}
	return nil
}

// UpdateAlertRule looks for the active rule evaluation and commands it to update the rule
func (sch *schedule) UpdateAlertRule(key ngmodels.AlertRuleKey, lastVersion int64) {
	ruleInfo, err := sch.registry.get(key)
	if err != nil {
		return
	}
	ruleInfo.update(ruleVersion(lastVersion))
}

// UpdateAlertRulesByNamespaceUID looks for the active rule evaluation for every rule in the given namespace and commands it to update the rule.
func (sch *schedule) UpdateAlertRulesByNamespaceUID(ctx context.Context, orgID int64, uid string) error {
	q := ngmodels.ListAlertRulesQuery{
		OrgID:         orgID,
		NamespaceUIDs: []string{uid},
	}
	if err := sch.ruleStore.ListAlertRules(ctx, &q); err != nil {
		return err
	}

	for _, r := range q.Result {
		sch.UpdateAlertRule(ngmodels.AlertRuleKey{
			OrgID: orgID,
			UID:   r.UID,
		}, r.Version)
	}

	return nil
}

// DeleteAlertRule stops evaluation of the rule, deletes it from active rules, and cleans up state cache.
func (sch *schedule) DeleteAlertRule(key ngmodels.AlertRuleKey) {
	// It can happen that the scheduler has deleted the alert rule before the
	// Ruler API has called DeleteAlertRule. This can happen as requests to
	// the Ruler API do not hold an exclusive lock over all scheduler operations.
	if _, ok := sch.schedulableAlertRules.del(key); !ok {
		sch.log.Info("alert rule cannot be removed from the scheduler as it is not scheduled", "uid", key.UID, "org_id", key.OrgID)
	}

	// Delete the rule routine
	ruleInfo, ok := sch.registry.del(key)
	if !ok {
		sch.log.Info("alert rule cannot be stopped as it is not running", "uid", key.UID, "org_id", key.OrgID)
		return
	}
	// stop rule evaluation
	ruleInfo.stop()

	// Our best bet at this point is that we update the metrics with what we hope to schedule in the next tick.
	alertRules := sch.schedulableAlertRules.all()
	sch.metrics.SchedulableAlertRules.Set(float64(len(alertRules)))
	sch.metrics.SchedulableAlertRulesHash.Set(float64(hashUIDs(alertRules)))
}

func (sch *schedule) schedulePeriodic(ctx context.Context) error {
	dispatcherGroup, ctx := errgroup.WithContext(ctx)
	for {
		select {
		case tick := <-sch.ticker.C:
			// We use Round(0) on the start time to remove the monotonic clock.
			// This is required as ticks from the ticker and time.Now() can have
			// a monotonic clock that when subtracted do not represent the delta
			// in wall clock time.
			start := time.Now().Round(0)
			sch.metrics.BehindSeconds.Set(start.Sub(tick).Seconds())

			tickNum := tick.Unix() / int64(sch.baseInterval.Seconds())

			if err := sch.updateSchedulableAlertRules(ctx); err != nil {
				sch.log.Error("scheduler failed to update alert rules", "err", err)
			}
			alertRules := sch.schedulableAlertRules.all()

			// registeredDefinitions is a map used for finding deleted alert rules
			// initially it is assigned to all known alert rules from the previous cycle
			// each alert rule found also in this cycle is removed
			// so, at the end, the remaining registered alert rules are the deleted ones
			registeredDefinitions := sch.registry.keyMap()

			// While these are the rules that we iterate over, at the moment there's no 100% guarantee that they'll be
			// scheduled as rules could be removed before we get a chance to evaluate them.
			sch.metrics.SchedulableAlertRules.Set(float64(len(alertRules)))
			sch.metrics.SchedulableAlertRulesHash.Set(float64(hashUIDs(alertRules)))

			type readyToRunItem struct {
				key      ngmodels.AlertRuleKey
				ruleName string
				ruleInfo *alertRuleInfo
				version  int64
			}

			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertRules {
				key := item.GetKey()
				itemVersion := item.Version
				ruleInfo, newRoutine := sch.registry.getOrCreateInfo(ctx, key)

				// enforce minimum evaluation interval
				if item.IntervalSeconds < int64(sch.minRuleInterval.Seconds()) {
					sch.log.Debug("interval adjusted", "rule_interval_seconds", item.IntervalSeconds, "min_interval_seconds", sch.minRuleInterval.Seconds(), "key", key)
					item.IntervalSeconds = int64(sch.minRuleInterval.Seconds())
				}

				invalidInterval := item.IntervalSeconds%int64(sch.baseInterval.Seconds()) != 0

				if newRoutine && !invalidInterval {
					dispatcherGroup.Go(func() error {
						return sch.ruleRoutine(ruleInfo.ctx, key, ruleInfo.evalCh, ruleInfo.updateCh)
					})
				}

				if invalidInterval {
					// this is expected to be always false
					// given that we validate interval during alert rule updates
					sch.log.Debug("alert rule with invalid interval will be ignored: interval should be divided exactly by scheduler interval", "key", key, "interval", time.Duration(item.IntervalSeconds)*time.Second, "scheduler interval", sch.baseInterval)
					continue
				}

				itemFrequency := item.IntervalSeconds / int64(sch.baseInterval.Seconds())
				if item.IntervalSeconds != 0 && tickNum%itemFrequency == 0 {
					readyToRun = append(readyToRun, readyToRunItem{key: key, ruleName: item.Title, ruleInfo: ruleInfo, version: itemVersion})
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
					success, dropped := item.ruleInfo.eval(tick, item.version)
					if !success {
						sch.log.Debug("scheduled evaluation was canceled because evaluation routine was stopped", "uid", item.key.UID, "org", item.key.OrgID, "time", tick)
						return
					}
					if dropped != nil {
						sch.log.Warn("Alert rule evaluation is too slow - dropped tick", "uid", item.key.UID, "org", item.key.OrgID, "time", tick)
						orgID := fmt.Sprint(item.key.OrgID)
						sch.metrics.EvaluationMissed.WithLabelValues(orgID, item.ruleName).Inc()
					}
				})
			}

			// unregister and stop routines of the deleted alert rules
			for key := range registeredDefinitions {
				sch.DeleteAlertRule(key)
			}

			sch.metrics.SchedulePeriodicDuration.Observe(time.Since(start).Seconds())
		case <-ctx.Done():
			waitErr := dispatcherGroup.Wait()

			orgIds, err := sch.instanceStore.FetchOrgIds(ctx)
			if err != nil {
				sch.log.Error("unable to fetch orgIds", "msg", err.Error())
			}

			for _, v := range orgIds {
				sch.saveAlertStates(ctx, sch.stateManager.GetAll(v))
			}

			sch.stateManager.Close()
			return waitErr
		}
	}
}

func (sch *schedule) ruleRoutine(grafanaCtx context.Context, key ngmodels.AlertRuleKey, evalCh <-chan *evaluation, updateCh <-chan ruleVersion) error {
	logger := sch.log.New("uid", key.UID, "org", key.OrgID)
	logger.Debug("alert rule routine started")

	orgID := fmt.Sprint(key.OrgID)
	evalTotal := sch.metrics.EvalTotal.WithLabelValues(orgID)
	evalDuration := sch.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotalFailures := sch.metrics.EvalFailures.WithLabelValues(orgID)

	clearState := func() {
		states := sch.stateManager.GetStatesForRuleUID(key.OrgID, key.UID)
		expiredAlerts := FromAlertsStateToStoppedAlert(states, sch.appURL, sch.clock)
		sch.stateManager.RemoveByRuleUID(key.OrgID, key.UID)
		sch.alertsSender.Send(key, expiredAlerts)
	}

	updateRule := func(ctx context.Context, oldRule *ngmodels.AlertRule) (*ngmodels.AlertRule, map[string]string, error) {
		q := ngmodels.GetAlertRuleByUIDQuery{OrgID: key.OrgID, UID: key.UID}
		err := sch.ruleStore.GetAlertRuleByUID(ctx, &q)
		if err != nil {
			logger.Error("failed to fetch alert rule", "err", err)
			return nil, nil, err
		}
		if oldRule != nil && oldRule.Version < q.Result.Version {
			clearState()
		}
		newLabels, err := sch.getRuleExtraLabels(ctx, q.Result)
		if err != nil {
			return nil, nil, err
		}
		return q.Result, newLabels, nil
	}

	evaluate := func(ctx context.Context, r *ngmodels.AlertRule, extraLabels map[string]string, attempt int64, e *evaluation) {
		logger := logger.New("version", r.Version, "attempt", attempt, "now", e.scheduledAt)
		start := sch.clock.Now()

		results := sch.evaluator.ConditionEval(ctx, r.GetEvalCondition(), e.scheduledAt)
		dur := sch.clock.Now().Sub(start)
		evalTotal.Inc()
		evalDuration.Observe(dur.Seconds())
		if results.HasErrors() {
			evalTotalFailures.Inc()
			logger.Error("failed to evaluate alert rule", "results", results, "duration", dur)
		} else {
			logger.Debug("alert rule evaluated", "results", results, "duration", dur)
		}

		processedStates := sch.stateManager.ProcessEvalResults(ctx, e.scheduledAt, r, results, extraLabels)
		sch.saveAlertStates(ctx, processedStates)
		alerts := FromAlertStateToPostableAlerts(processedStates, sch.stateManager, sch.appURL)
		sch.alertsSender.Send(key, alerts)
	}

	retryIfError := func(f func(attempt int64) error) error {
		var attempt int64
		var err error
		for attempt = 0; attempt < sch.maxAttempts; attempt++ {
			err = f(attempt)
			if err == nil {
				return nil
			}
		}
		return err
	}

	evalRunning := false
	var currentRule *ngmodels.AlertRule
	var extraLabels map[string]string
	defer sch.stopApplied(key)
	for {
		select {
		// used by external services (API) to notify that rule is updated.
		case version := <-updateCh:
			// sometimes it can happen when, for example, the rule evaluation took so long,
			// and there were two concurrent messages in updateCh and evalCh, and the eval's one got processed first.
			// therefore, at the time when message from updateCh is processed the current rule will have
			// at least the same version (or greater) and the state created for the new version of the rule.
			if currentRule != nil && int64(version) <= currentRule.Version {
				logger.Info("skip updating rule because its current version is actual", "current_version", currentRule.Version, "new_version", version)
				continue
			}
			logger.Info("fetching new version of the rule")
			err := retryIfError(func(attempt int64) error {
				newRule, newExtraLabels, err := updateRule(grafanaCtx, currentRule)
				if err != nil {
					return err
				}
				logger.Debug("new alert rule version fetched", "title", newRule.Title, "version", newRule.Version)
				currentRule = newRule
				extraLabels = newExtraLabels
				return nil
			})
			if err != nil {
				logger.Error("updating rule failed after all retries", "err", err)
			}
		// evalCh - used by the scheduler to signal that evaluation is needed.
		case ctx, ok := <-evalCh:
			if !ok {
				logger.Debug("evaluation channel has been closed. Exiting")
				return nil
			}
			if evalRunning {
				continue
			}

			func() {
				evalRunning = true
				defer func() {
					evalRunning = false
					sch.evalApplied(key, ctx.scheduledAt)
				}()

				err := retryIfError(func(attempt int64) error {
					// fetch latest alert rule version
					if currentRule == nil || currentRule.Version < ctx.version {
						newRule, newExtraLabels, err := updateRule(grafanaCtx, currentRule)
						if err != nil {
							return err
						}
						currentRule = newRule
						extraLabels = newExtraLabels
						logger.Debug("new alert rule version fetched", "title", newRule.Title, "version", newRule.Version)
					}
					evaluate(grafanaCtx, currentRule, extraLabels, attempt, ctx)
					return nil
				})
				if err != nil {
					logger.Error("evaluation failed after all retries", "err", err)
				}
			}()
		case <-grafanaCtx.Done():
			clearState()
			logger.Debug("stopping alert rule routine")
			return nil
		}
	}
}

func (sch *schedule) saveAlertStates(ctx context.Context, states []*state.State) {
	sch.log.Debug("saving alert states", "count", len(states))
	for _, s := range states {
		cmd := ngmodels.SaveAlertInstanceCommand{
			RuleOrgID:         s.OrgID,
			RuleUID:           s.AlertRuleUID,
			Labels:            ngmodels.InstanceLabels(s.Labels),
			State:             ngmodels.InstanceStateType(s.State.String()),
			StateReason:       s.StateReason,
			LastEvalTime:      s.LastEvaluationTime,
			CurrentStateSince: s.StartsAt,
			CurrentStateEnd:   s.EndsAt,
		}
		err := sch.instanceStore.SaveAlertInstance(ctx, &cmd)
		if err != nil {
			sch.log.Error("failed to save alert state", "uid", s.AlertRuleUID, "orgId", s.OrgID, "labels", s.Labels.String(), "state", s.State.String(), "msg", err.Error())
		}
	}
}

// folderUpdateHandler listens for folder update events and updates all rules in the given folder.
func (sch *schedule) folderUpdateHandler(ctx context.Context, evt *events.FolderUpdated) error {
	if sch.disableGrafanaFolder {
		return nil
	}
	return sch.UpdateAlertRulesByNamespaceUID(ctx, evt.OrgID, evt.UID)
}

// overrideCfg is only used on tests.
func (sch *schedule) overrideCfg(cfg SchedulerCfg) {
	sch.clock = cfg.C
	sch.baseInterval = cfg.Cfg.BaseInterval
	sch.ticker.Stop()
	sch.ticker = alerting.NewTicker(cfg.C, cfg.Cfg.BaseInterval, cfg.Metrics.Ticker)
	sch.evalAppliedFunc = cfg.EvalAppliedFunc
	sch.stopAppliedFunc = cfg.StopAppliedFunc
}

// evalApplied is only used on tests.
func (sch *schedule) evalApplied(alertDefKey ngmodels.AlertRuleKey, now time.Time) {
	if sch.evalAppliedFunc == nil {
		return
	}

	sch.evalAppliedFunc(alertDefKey, now)
}

// stopApplied is only used on tests.
func (sch *schedule) stopApplied(alertDefKey ngmodels.AlertRuleKey) {
	if sch.stopAppliedFunc == nil {
		return
	}

	sch.stopAppliedFunc(alertDefKey)
}

func (sch *schedule) getRuleExtraLabels(ctx context.Context, alertRule *ngmodels.AlertRule) (map[string]string, error) {
	extraLabels := make(map[string]string, 4)

	extraLabels[ngmodels.NamespaceUIDLabel] = alertRule.NamespaceUID
	extraLabels[prometheusModel.AlertNameLabel] = alertRule.Title
	extraLabels[ngmodels.RuleUIDLabel] = alertRule.UID

	user := &models.SignedInUser{
		UserId:  0,
		OrgRole: models.ROLE_ADMIN,
		OrgId:   alertRule.OrgID,
	}

	if !sch.disableGrafanaFolder {
		folder, err := sch.ruleStore.GetNamespaceByUID(ctx, alertRule.NamespaceUID, alertRule.OrgID, user)
		if err != nil {
			sch.log.Error("failed to fetch alert rule namespace", "err", err, "uid", alertRule.UID, "org", alertRule.OrgID, "namespace_uid", alertRule.NamespaceUID)
			return nil, err
		}
		extraLabels[ngmodels.FolderTitleLabel] = folder.Title
	}
	return extraLabels, nil
}
