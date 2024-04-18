package schedule

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util/ticker"
)

// ScheduleService is an interface for a service that schedules the evaluation
// of alert rules.
type ScheduleService interface {
	// Run the scheduler until the context is canceled or the scheduler returns
	// an error. The scheduler is terminated when this function returns.
	Run(context.Context) error
}

// retryDelay represents how long to wait between each failed rule evaluation.
const retryDelay = 1 * time.Second

// AlertsSender is an interface for a service that is responsible for sending notifications to the end-user.
//
//go:generate mockery --name AlertsSender --structname AlertsSenderMock --inpackage --filename alerts_sender_mock.go --with-expecter
type AlertsSender interface {
	Send(ctx context.Context, key ngmodels.AlertRuleKey, alerts definitions.PostableAlerts)
}

// RulesStore is a store that provides alert rules for scheduling
type RulesStore interface {
	GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error)
	GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.GetAlertRulesForSchedulingQuery) error
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each rule gets its own channel and routine
	registry ruleRegistry

	maxAttempts int64

	clock clock.Clock

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalAppliedFunc func(ngmodels.AlertRuleKey, time.Time)

	// stopApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from stopApplied is handled.
	stopAppliedFunc func(ngmodels.AlertRuleKey)

	log log.Logger

	evaluatorFactory eval.EvaluatorFactory

	ruleStore RulesStore

	stateManager *state.Manager

	appURL               *url.URL
	disableGrafanaFolder bool
	jitterEvaluations    JitterStrategy

	metrics *metrics.Scheduler

	alertsSender    AlertsSender
	minRuleInterval time.Duration

	// schedulableAlertRules contains the alert rules that are considered for
	// evaluation in the current tick. The evaluation of an alert rule in the
	// current tick depends on its evaluation interval and when it was
	// last evaluated.
	schedulableAlertRules alertRulesRegistry

	tracer tracing.Tracer
}

// SchedulerCfg is the scheduler configuration.
type SchedulerCfg struct {
	MaxAttempts          int64
	BaseInterval         time.Duration
	C                    clock.Clock
	MinRuleInterval      time.Duration
	DisableGrafanaFolder bool
	AppURL               *url.URL
	JitterEvaluations    JitterStrategy
	EvaluatorFactory     eval.EvaluatorFactory
	RuleStore            RulesStore
	Metrics              *metrics.Scheduler
	AlertSender          AlertsSender
	Tracer               tracing.Tracer
	Log                  log.Logger
}

// NewScheduler returns a new scheduler.
func NewScheduler(cfg SchedulerCfg, stateManager *state.Manager) *schedule {
	const minMaxAttempts = int64(1)
	if cfg.MaxAttempts < minMaxAttempts {
		cfg.Log.Warn("Invalid scheduler maxAttempts, using a safe minimum", "configured", cfg.MaxAttempts, "actual", minMaxAttempts)
		cfg.MaxAttempts = minMaxAttempts
	}

	sch := schedule{
		registry:              newRuleRegistry(),
		maxAttempts:           cfg.MaxAttempts,
		clock:                 cfg.C,
		baseInterval:          cfg.BaseInterval,
		log:                   cfg.Log,
		evaluatorFactory:      cfg.EvaluatorFactory,
		ruleStore:             cfg.RuleStore,
		metrics:               cfg.Metrics,
		appURL:                cfg.AppURL,
		disableGrafanaFolder:  cfg.DisableGrafanaFolder,
		jitterEvaluations:     cfg.JitterEvaluations,
		stateManager:          stateManager,
		minRuleInterval:       cfg.MinRuleInterval,
		schedulableAlertRules: alertRulesRegistry{rules: make(map[ngmodels.AlertRuleKey]*ngmodels.AlertRule)},
		alertsSender:          cfg.AlertSender,
		tracer:                cfg.Tracer,
	}

	return &sch
}

func (sch *schedule) Run(ctx context.Context) error {
	sch.log.Info("Starting scheduler", "tickInterval", sch.baseInterval, "maxAttempts", sch.maxAttempts)
	t := ticker.New(sch.clock, sch.baseInterval, sch.metrics.Ticker)
	defer t.Stop()

	if err := sch.schedulePeriodic(ctx, t); err != nil {
		sch.log.Error("Failure while running the rule evaluation loop", "error", err)
	}
	return nil
}

// Rules fetches the entire set of rules considered for evaluation by the scheduler on the next tick.
// Such rules are not guaranteed to have been evaluated by the scheduler.
// Rules returns all supplementary metadata for the rules that is stored by the scheduler - namely, the set of folder titles.
func (sch *schedule) Rules() ([]*ngmodels.AlertRule, map[ngmodels.FolderKey]string) {
	return sch.schedulableAlertRules.all()
}

// deleteAlertRule stops evaluation of the rule, deletes it from active rules, and cleans up state cache.
func (sch *schedule) deleteAlertRule(keys ...ngmodels.AlertRuleKey) {
	for _, key := range keys {
		// It can happen that the scheduler has deleted the alert rule before the
		// Ruler API has called DeleteAlertRule. This can happen as requests to
		// the Ruler API do not hold an exclusive lock over all scheduler operations.
		if _, ok := sch.schedulableAlertRules.del(key); !ok {
			sch.log.Info("Alert rule cannot be removed from the scheduler as it is not scheduled", key.LogContext()...)
		}
		// Delete the rule routine
		ruleRoutine, ok := sch.registry.del(key)
		if !ok {
			sch.log.Info("Alert rule cannot be stopped as it is not running", key.LogContext()...)
			continue
		}
		// stop rule evaluation
		ruleRoutine.Stop(errRuleDeleted)
	}
	// Our best bet at this point is that we update the metrics with what we hope to schedule in the next tick.
	alertRules, _ := sch.schedulableAlertRules.all()
	sch.updateRulesMetrics(alertRules)
}

func (sch *schedule) schedulePeriodic(ctx context.Context, t *ticker.T) error {
	dispatcherGroup, ctx := errgroup.WithContext(ctx)
	for {
		select {
		case tick := <-t.C:
			// We use Round(0) on the start time to remove the monotonic clock.
			// This is required as ticks from the ticker and time.Now() can have
			// a monotonic clock that when subtracted do not represent the delta
			// in wall clock time.
			start := time.Now().Round(0)
			sch.metrics.BehindSeconds.Set(start.Sub(tick).Seconds())

			sch.processTick(ctx, dispatcherGroup, tick)

			sch.metrics.SchedulePeriodicDuration.Observe(time.Since(start).Seconds())
		case <-ctx.Done():
			// waiting for all rule evaluation routines to stop
			waitErr := dispatcherGroup.Wait()
			return waitErr
		}
	}
}

type readyToRunItem struct {
	ruleRoutine Rule
	Evaluation
}

// TODO refactor to accept a callback for tests that will be called with things that are returned currently, and return nothing.
// Returns a slice of rules that were scheduled for evaluation, map of stopped rules, and a slice of updated rules
func (sch *schedule) processTick(ctx context.Context, dispatcherGroup *errgroup.Group, tick time.Time) ([]readyToRunItem, map[ngmodels.AlertRuleKey]struct{}, []ngmodels.AlertRuleKeyWithVersion) {
	tickNum := tick.Unix() / int64(sch.baseInterval.Seconds())

	// update the local registry. If there was a difference between the previous state and the current new state, rulesDiff will contains keys of rules that were updated.
	rulesDiff, err := sch.updateSchedulableAlertRules(ctx)
	updated := rulesDiff.updated
	if updated == nil { // make sure map is not nil
		updated = map[ngmodels.AlertRuleKey]struct{}{}
	}
	if err != nil {
		sch.log.Error("Failed to update alert rules", "error", err)
	}

	// this is the new current state. rulesDiff contains the previously existing rules that were different between this state and the previous state.
	alertRules, folderTitles := sch.schedulableAlertRules.all()

	// registeredDefinitions is a map used for finding deleted alert rules
	// initially it is assigned to all known alert rules from the previous cycle
	// each alert rule found also in this cycle is removed
	// so, at the end, the remaining registered alert rules are the deleted ones
	registeredDefinitions := sch.registry.keyMap()

	sch.updateRulesMetrics(alertRules)

	readyToRun := make([]readyToRunItem, 0)
	updatedRules := make([]ngmodels.AlertRuleKeyWithVersion, 0, len(updated)) // this is needed for tests only
	missingFolder := make(map[string][]string)
	ruleFactory := newRuleFactory(
		sch.appURL,
		sch.disableGrafanaFolder,
		sch.maxAttempts,
		sch.alertsSender,
		sch.stateManager,
		sch.evaluatorFactory,
		&sch.schedulableAlertRules,
		sch.clock,
		sch.metrics,
		sch.log,
		sch.tracer,
		sch.evalAppliedFunc,
		sch.stopAppliedFunc,
	)
	for _, item := range alertRules {
		key := item.GetKey()
		ruleRoutine, newRoutine := sch.registry.getOrCreate(ctx, key, ruleFactory)

		// enforce minimum evaluation interval
		if item.IntervalSeconds < int64(sch.minRuleInterval.Seconds()) {
			sch.log.Debug("Interval adjusted", append(key.LogContext(), "originalInterval", item.IntervalSeconds, "adjustedInterval", sch.minRuleInterval.Seconds())...)
			item.IntervalSeconds = int64(sch.minRuleInterval.Seconds())
		}

		invalidInterval := item.IntervalSeconds%int64(sch.baseInterval.Seconds()) != 0

		if newRoutine && !invalidInterval {
			dispatcherGroup.Go(func() error {
				return ruleRoutine.Run(key)
			})
		}

		if invalidInterval {
			// this is expected to be always false
			// given that we validate interval during alert rule updates
			sch.log.Warn("Rule has an invalid interval and will be ignored. Interval should be divided exactly by scheduler interval", append(key.LogContext(), "ruleInterval", time.Duration(item.IntervalSeconds)*time.Second, "schedulerInterval", sch.baseInterval)...)
			continue
		}

		itemFrequency := item.IntervalSeconds / int64(sch.baseInterval.Seconds())
		offset := jitterOffsetInTicks(item, sch.baseInterval, sch.jitterEvaluations)
		isReadyToRun := item.IntervalSeconds != 0 && (tickNum%itemFrequency)-offset == 0

		var folderTitle string
		if !sch.disableGrafanaFolder {
			title, ok := folderTitles[item.GetFolderKey()]
			if ok {
				folderTitle = title
			} else {
				missingFolder[item.NamespaceUID] = append(missingFolder[item.NamespaceUID], item.UID)
			}
		}

		if isReadyToRun {
			sch.log.Debug("Rule is ready to run on the current tick", "uid", item.UID, "tick", tickNum, "frequency", itemFrequency, "offset", offset)
			readyToRun = append(readyToRun, readyToRunItem{ruleRoutine: ruleRoutine, Evaluation: Evaluation{
				scheduledAt: tick,
				rule:        item,
				folderTitle: folderTitle,
			}})
		}
		if _, isUpdated := updated[key]; isUpdated && !isReadyToRun {
			// if we do not need to eval the rule, check the whether rule was just updated and if it was, notify evaluation routine about that
			sch.log.Debug("Rule has been updated. Notifying evaluation routine", key.LogContext()...)
			go func(routine Rule, rule *ngmodels.AlertRule) {
				routine.Update(RuleVersionAndPauseStatus{
					Fingerprint: ruleWithFolder{rule: rule, folderTitle: folderTitle}.Fingerprint(),
					IsPaused:    rule.IsPaused,
				})
			}(ruleRoutine, item)
			updatedRules = append(updatedRules, ngmodels.AlertRuleKeyWithVersion{
				Version:      item.Version,
				AlertRuleKey: item.GetKey(),
			})
		}

		// remove the alert rule from the registered alert rules
		delete(registeredDefinitions, key)
	}

	if len(missingFolder) > 0 { // if this happens then there can be problems with fetching folders from the database.
		sch.log.Warn("Unable to obtain folder titles for some rules", "missingFolderUIDToRuleUID", missingFolder)
	}

	var step int64 = 0
	if len(readyToRun) > 0 {
		step = sch.baseInterval.Nanoseconds() / int64(len(readyToRun))
	}

	for i := range readyToRun {
		item := readyToRun[i]

		time.AfterFunc(time.Duration(int64(i)*step), func() {
			key := item.rule.GetKey()
			success, dropped := item.ruleRoutine.Eval(&item.Evaluation)
			if !success {
				sch.log.Debug("Scheduled evaluation was canceled because evaluation routine was stopped", append(key.LogContext(), "time", tick)...)
				return
			}
			if dropped != nil {
				sch.log.Warn("Tick dropped because alert rule evaluation is too slow", append(key.LogContext(), "time", tick)...)
				orgID := fmt.Sprint(key.OrgID)
				sch.metrics.EvaluationMissed.WithLabelValues(orgID, item.rule.Title).Inc()
			}
		})
	}

	// unregister and stop routines of the deleted alert rules
	toDelete := make([]ngmodels.AlertRuleKey, 0, len(registeredDefinitions))
	for key := range registeredDefinitions {
		toDelete = append(toDelete, key)
	}
	sch.deleteAlertRule(toDelete...)
	return readyToRun, registeredDefinitions, updatedRules
}
