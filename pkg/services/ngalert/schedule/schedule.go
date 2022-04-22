package schedule

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

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

	// AlertmanagersFor returns all the discovered Alertmanager URLs for the
	// organization.
	AlertmanagersFor(orgID int64) []*url.URL

	// DroppedAlertmanagersFor returns all the dropped Alertmanager URLs for the
	// organization.
	DroppedAlertmanagersFor(orgID int64) []*url.URL
	// UpdateAlertRule notifies scheduler that a rule has been changed
	UpdateAlertRule(key models.AlertRuleKey)
	// DeleteAlertRule notifies scheduler that a rule has been changed
	DeleteAlertRule(key models.AlertRuleKey)
	// the following are used by tests only used for tests
	evalApplied(models.AlertRuleKey, time.Time)
	stopApplied(models.AlertRuleKey)
	overrideCfg(cfg SchedulerCfg)
}

type AlertNotifier interface {
	Notify(key models.AlertRuleKey, states []*state.State) error
	Expire(key models.AlertRuleKey, states []*state.State) error
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert rule gets its own channel and routine
	registry alertRuleRegistry

	maxAttempts int64

	clock clock.Clock

	ticker *alerting.Ticker

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

	ruleStore         store.RuleStore
	instanceStore     store.InstanceStore
	orgStore          store.OrgStore
	expressionService *expr.Service

	stateManager *state.Manager

	appURL *url.URL

	metrics *metrics.Scheduler

	disabledOrgs    map[int64]struct{}
	minRuleInterval time.Duration
	notifier        AlertNotifier
}

// SchedulerCfg is the scheduler configuration.
type SchedulerCfg struct {
	C                       clock.Clock
	BaseInterval            time.Duration
	Logger                  log.Logger
	EvalAppliedFunc         func(models.AlertRuleKey, time.Time)
	MaxAttempts             int64
	StopAppliedFunc         func(models.AlertRuleKey)
	Evaluator               eval.Evaluator
	RuleStore               store.RuleStore
	OrgStore                store.OrgStore
	InstanceStore           store.InstanceStore
	AdminConfigStore        store.AdminConfigurationStore
	MultiOrgNotifier        *notifier.MultiOrgAlertmanager
	Metrics                 *metrics.Scheduler
	AdminConfigPollInterval time.Duration
	DisabledOrgs            map[int64]struct{}
	MinRuleInterval         time.Duration
}

// NewScheduler returns a new schedule.
func NewScheduler(cfg SchedulerCfg, expressionService *expr.Service, appURL *url.URL, stateManager *state.Manager, notifier AlertNotifier) *schedule {
	ticker := alerting.NewTicker(cfg.C, cfg.BaseInterval, cfg.Metrics.Ticker)

	sch := schedule{
		registry:          alertRuleRegistry{alertRuleInfo: make(map[models.AlertRuleKey]*alertRuleInfo)},
		maxAttempts:       cfg.MaxAttempts,
		clock:             cfg.C,
		baseInterval:      cfg.BaseInterval,
		log:               cfg.Logger,
		ticker:            ticker,
		evalAppliedFunc:   cfg.EvalAppliedFunc,
		stopAppliedFunc:   cfg.StopAppliedFunc,
		evaluator:         cfg.Evaluator,
		ruleStore:         cfg.RuleStore,
		instanceStore:     cfg.InstanceStore,
		orgStore:          cfg.OrgStore,
		expressionService: expressionService,
		metrics:           cfg.Metrics,
		appURL:            appURL,
		stateManager:      stateManager,
		disabledOrgs:      cfg.DisabledOrgs,
		minRuleInterval:   cfg.MinRuleInterval,
		notifier:          notifier,
	}
	return &sch
}

func (sch *schedule) Run(ctx context.Context) error {
	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		if err := sch.schedulePeriodic(ctx); err != nil {
			sch.log.Error("failure while running the rule evaluation loop", "err", err)
		}
	}()

	wg.Wait()
	return nil
}

// UpdateAlertRule looks for the active rule evaluation and commands it to update the rule
func (sch *schedule) UpdateAlertRule(key models.AlertRuleKey) {
	ruleInfo, err := sch.registry.get(key)
	if err != nil {
		return
	}
	ruleInfo.update()
}

// DeleteAlertRule stops evaluation of the rule, deletes it from active rules, and cleans up state cache.
func (sch *schedule) DeleteAlertRule(key models.AlertRuleKey) {
	ruleInfo, ok := sch.registry.del(key)
	if !ok {
		sch.log.Info("unable to delete alert rule routine information by key", "uid", key.UID, "org_id", key.OrgID)
		return
	}
	// stop rule evaluation
	ruleInfo.stop()
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
			disabledOrgs := make([]int64, 0, len(sch.disabledOrgs))
			for disabledOrg := range sch.disabledOrgs {
				disabledOrgs = append(disabledOrgs, disabledOrg)
			}

			alertRules := sch.getAlertRules(ctx, disabledOrgs)
			sch.log.Debug("alert rules fetched", "count", len(alertRules), "disabled_orgs", disabledOrgs)

			// registeredDefinitions is a map used for finding deleted alert rules
			// initially it is assigned to all known alert rules from the previous cycle
			// each alert rule found also in this cycle is removed
			// so, at the end, the remaining registered alert rules are the deleted ones
			registeredDefinitions := sch.registry.keyMap()

			type readyToRunItem struct {
				key      models.AlertRuleKey
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
					readyToRun = append(readyToRun, readyToRunItem{key: key, ruleInfo: ruleInfo, version: itemVersion})
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
					success := item.ruleInfo.eval(tick, item.version)
					if !success {
						sch.log.Debug("Scheduled evaluation was canceled because evaluation routine was stopped", "uid", item.key.UID, "org", item.key.OrgID, "time", tick)
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

func (sch *schedule) ruleRoutine(grafanaCtx context.Context, key models.AlertRuleKey, evalCh <-chan *evaluation, updateCh <-chan struct{}) error {
	logger := sch.log.New("uid", key.UID, "org", key.OrgID)
	logger.Debug("alert rule routine started")

	orgID := fmt.Sprint(key.OrgID)
	evalTotal := sch.metrics.EvalTotal.WithLabelValues(orgID)
	evalDuration := sch.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotalFailures := sch.metrics.EvalFailures.WithLabelValues(orgID)

	clearState := func() {
		states := sch.stateManager.GetStatesForRuleUID(key.OrgID, key.UID)
		sch.stateManager.RemoveByRuleUID(key.OrgID, key.UID)
		toExpire := make([]*state.State, 0, len(states))
		for _, s := range states {
			if s.State == eval.Normal || s.State == eval.Pending {
				continue
			}
			toExpire = append(toExpire, s)
		}
		err := sch.notifier.Expire(key, toExpire)
		if err != nil {
			logger.Error("failed to expire firing alerts in the notifier", "err", err)
		}
	}

	updateRule := func(ctx context.Context, oldRule *models.AlertRule) (*models.AlertRule, error) {
		q := models.GetAlertRuleByUIDQuery{OrgID: key.OrgID, UID: key.UID}
		err := sch.ruleStore.GetAlertRuleByUID(ctx, &q)
		if err != nil {
			logger.Error("failed to fetch alert rule", "err", err)
			return nil, err
		}
		if oldRule != nil && oldRule.Version < q.Result.Version {
			clearState()
		}
		return q.Result, nil
	}

	evaluate := func(ctx context.Context, r *models.AlertRule, attempt int64, e *evaluation) error {
		logger := logger.New("version", r.Version, "attempt", attempt, "now", e.scheduledAt)
		start := sch.clock.Now()

		condition := models.Condition{
			Condition: r.Condition,
			OrgID:     r.OrgID,
			Data:      r.Data,
		}
		results, err := sch.evaluator.ConditionEval(&condition, e.scheduledAt, sch.expressionService)
		dur := sch.clock.Now().Sub(start)
		evalTotal.Inc()
		evalDuration.Observe(dur.Seconds())
		if err != nil {
			evalTotalFailures.Inc()
			// consider saving alert instance on error
			logger.Error("failed to evaluate alert rule", "duration", dur, "err", err)
			return err
		}
		logger.Debug("alert rule evaluated", "results", results, "duration", dur)

		processedStates := sch.stateManager.ProcessEvalResults(ctx, r, results)
		sch.saveAlertStates(ctx, processedStates)
		toNotify := make([]*state.State, 0, len(processedStates))
		sent := sch.clock.Now()
		for _, alertState := range toNotify {
			if !alertState.NeedsSending(sch.stateManager.ResendDelay) {
				continue
			}
			toNotify = append(toNotify, alertState)
			alertState.LastSentAt = sent
		}
		sch.stateManager.Put(toNotify)
		err = sch.notifier.Notify(key, toNotify)
		if err != nil {
			logger.Error("failed to notify about the firing alerts", "err", err)
			return nil
		}
		return nil
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
	var currentRule *models.AlertRule
	defer sch.stopApplied(key)
	for {
		select {
		// used by external services (API) to notify that rule is updated.
		case <-updateCh:
			logger.Info("fetching new version of the rule")
			err := retryIfError(func(attempt int64) error {
				newRule, err := updateRule(grafanaCtx, currentRule)
				if err != nil {
					return err
				}
				logger.Debug("new alert rule version fetched", "title", newRule.Title, "version", newRule.Version)
				currentRule = newRule
				return nil
			})
			if err != nil {
				logger.Error("updating rule failed after all retries", "error", err)
			}
		// evalCh - used by the scheduler to signal that evaluation is needed.
		case ctx, ok := <-evalCh:
			if !ok {
				logger.Debug("Evaluation channel has been closed. Exiting")
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
						newRule, err := updateRule(grafanaCtx, currentRule)
						if err != nil {
							return err
						}
						currentRule = newRule
						logger.Debug("new alert rule version fetched", "title", newRule.Title, "version", newRule.Version)
					}
					return evaluate(grafanaCtx, currentRule, attempt, ctx)
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
		cmd := models.SaveAlertInstanceCommand{
			RuleOrgID:         s.OrgID,
			RuleUID:           s.AlertRuleUID,
			Labels:            models.InstanceLabels(s.Labels),
			State:             models.InstanceStateType(s.State.String()),
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
