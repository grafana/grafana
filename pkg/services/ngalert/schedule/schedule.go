package schedule

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/ticker"
)

// ScheduleService is an interface for a service that schedules the evaluation
// of alert rules.
type ScheduleService interface {
	// Run the scheduler until the context is canceled or the scheduler returns
	// an error. The scheduler is terminated when this function returns.
	Run(context.Context) error
	RunRuleEvaluation(ctx context.Context, evalReq ngmodels.ExternalAlertEvaluationRequest) error // LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add logzio external evaluation
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

	// each alert rule gets its own channel and routine
	registry alertRuleInfoRegistry

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

	scheduledEvalEnabled bool // LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add scheduled evaluation enabled config
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
	ScheduledEvalEnabled bool // LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add scheduled evaluation enabled config
}

// NewScheduler returns a new schedule.
func NewScheduler(cfg SchedulerCfg, stateManager *state.Manager) *schedule {
	const minMaxAttempts = int64(1)
	if cfg.MaxAttempts < minMaxAttempts {
		cfg.Log.Warn("Invalid scheduler maxAttempts, using a safe minimum", "configured", cfg.MaxAttempts, "actual", minMaxAttempts)
		cfg.MaxAttempts = minMaxAttempts
	}

	sch := schedule{
		registry:              alertRuleInfoRegistry{alertRuleInfo: make(map[ngmodels.AlertRuleKey]*alertRuleInfo)},
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
		scheduledEvalEnabled:  cfg.ScheduledEvalEnabled, // LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add scheduled evaluation enabled config
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
		ruleInfo, ok := sch.registry.del(key)
		if !ok {
			sch.log.Info("Alert rule cannot be stopped as it is not running", key.LogContext()...)
			continue
		}
		// stop rule evaluation
		ruleInfo.stop(errRuleDeleted)
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
	ruleInfo *alertRuleInfo
	evaluation
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
	for _, item := range alertRules {
		key := item.GetKey()
		ruleInfo, newRoutine := sch.registry.getOrCreateInfo(ctx, key)

		// enforce minimum evaluation interval
		if item.IntervalSeconds < int64(sch.minRuleInterval.Seconds()) {
			sch.log.Debug("Interval adjusted", append(key.LogContext(), "originalInterval", item.IntervalSeconds, "adjustedInterval", sch.minRuleInterval.Seconds())...)
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

		// LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add scheduled evaluation enabled config
		if sch.scheduledEvalEnabled {
			if isReadyToRun {
				sch.log.Debug("Rule is ready to run on the current tick", "uid", item.UID, "tick", tickNum, "frequency", itemFrequency, "offset", offset)
				readyToRun = append(readyToRun, readyToRunItem{ruleInfo: ruleInfo, evaluation: evaluation{
					scheduledAt: tick,
					rule:        item,
					folderTitle: folderTitle,
				}})
			}
		} else {
			sch.log.Debug("Scheduled evaluation disabled, not adding alerts to run")
		}

		if _, isUpdated := updated[key]; isUpdated && !isReadyToRun {
			// if we do not need to eval the rule, check the whether rule was just updated and if it was, notify evaluation routine about that
			sch.log.Debug("Rule has been updated. Notifying evaluation routine", key.LogContext()...)
			go func(ri *alertRuleInfo, rule *ngmodels.AlertRule) {
				ri.update(ruleVersionAndPauseStatus{
					Fingerprint: ruleWithFolder{rule: rule, folderTitle: folderTitle}.Fingerprint(),
					IsPaused:    rule.IsPaused,
				})
			}(ruleInfo, item)
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
			success, dropped := item.ruleInfo.eval(&item.evaluation)
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

// LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add logzio external evaluation
func (sch *schedule) RunRuleEvaluation(ctx context.Context, evalReq ngmodels.ExternalAlertEvaluationRequest) error {
	logger := sch.log.FromContext(ctx)
	alertKey := ngmodels.AlertRuleKey{
		OrgID: evalReq.AlertRule.OrgID,
		UID:   evalReq.AlertRule.UID,
	}
	ev := evaluation{
		scheduledAt: evalReq.EvalTime,
		rule:        &evalReq.AlertRule,
		folderTitle: evalReq.FolderTitle,
		logzHeaders: evalReq.LogzHeaders,
	}

	if sch.registry.exists(alertKey) {
		// since we only get if exists then it shouldn't create and routine should exist
		ruleInfo, newRoutine := sch.registry.getOrCreateInfo(ctx, alertKey)
		if !newRoutine {
			logger.Debug("RunRuleEvaluation: sending ruleInfo.eval")
			sent, dropped := ruleInfo.eval(&ev)
			if !sent {
				return fmt.Errorf("evaluation was not sent")
			}
			if dropped != nil {
				logger.Warn("RunRuleEvaluation: got dropped eval", "dropped", dropped)
			}
		}
	} else {
		return fmt.Errorf("no rule routine for alert key %s", alertKey)
	}

	return nil
}

// LOGZ.IO GRAFANA CHANGE :: End

//nolint:gocyclo
func (sch *schedule) ruleRoutine(grafanaCtx context.Context, key ngmodels.AlertRuleKey, evalCh <-chan *evaluation, updateCh <-chan ruleVersionAndPauseStatus) error {
	grafanaCtx = ngmodels.WithRuleKey(grafanaCtx, key)
	logger := sch.log.FromContext(grafanaCtx)
	logger.Debug("Alert rule routine started")

	orgID := fmt.Sprint(key.OrgID)
	evalTotal := sch.metrics.EvalTotal.WithLabelValues(orgID)
	evalDuration := sch.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotalFailures := sch.metrics.EvalFailures.WithLabelValues(orgID)
	processDuration := sch.metrics.ProcessDuration.WithLabelValues(orgID)
	sendDuration := sch.metrics.SendDuration.WithLabelValues(orgID)

	notify := func(states []state.StateTransition) {
		expiredAlerts := state.FromAlertsStateToStoppedAlert(states, sch.appURL, sch.clock)
		if len(expiredAlerts.PostableAlerts) > 0 {
			sch.alertsSender.Send(grafanaCtx, key, expiredAlerts)
		}
	}

	resetState := func(ctx context.Context, isPaused bool) {
		rule := sch.schedulableAlertRules.get(key)
		reason := ngmodels.StateReasonUpdated
		if isPaused {
			reason = ngmodels.StateReasonPaused
		}
		states := sch.stateManager.ResetStateByRuleUID(ctx, rule, reason)
		notify(states)
	}

	evaluate := func(ctx context.Context, f fingerprint, attempt int64, e *evaluation, span trace.Span, retry bool) error {
		logger := logger.New("version", e.rule.Version, "fingerprint", f, "attempt", attempt, "now", e.scheduledAt).FromContext(ctx)
		start := sch.clock.Now()

		// LOGZ.IO GRAFANA CHANGE :: DEV-43889 - Add headers for logzio datasources support
		ctxWithLogzHeaders := context.WithValue(ctx, "logzioHeaders", e.logzHeaders)
		evalCtx := eval.NewContextWithPreviousResults(ctxWithLogzHeaders, SchedulerUserFor(e.rule.OrgID), sch.newLoadedMetricsReader(e.rule))
		// LOGZ.IO GRAFANA CHANGE :: End
		if sch.evaluatorFactory == nil {
			panic("evalfactory nil")
		}
		ruleEval, err := sch.evaluatorFactory.Create(evalCtx, e.rule.GetEvalCondition())
		var results eval.Results
		var dur time.Duration
		if err != nil {
			dur = sch.clock.Now().Sub(start)
			logger.Error("Failed to build rule evaluator", "error", err)
		} else {
			results, err = ruleEval.Evaluate(ctx, e.scheduledAt)
			dur = sch.clock.Now().Sub(start)
			if err != nil {
				logger.Error("Failed to evaluate rule", "error", err, "duration", dur)
			}
		}

		evalTotal.Inc()
		evalDuration.Observe(dur.Seconds())

		if ctx.Err() != nil { // check if the context is not cancelled. The evaluation can be a long-running task.
			span.SetStatus(codes.Error, "rule evaluation cancelled")
			logger.Debug("Skip updating the state because the context has been cancelled")
			return nil
		}

		if err != nil || results.HasErrors() {
			evalTotalFailures.Inc()

			// Only retry (return errors) if this isn't the last attempt, otherwise skip these return operations.
			if retry {
				// The only thing that can return non-nil `err` from ruleEval.Evaluate is the server side expression pipeline.
				// This includes transport errors such as transient network errors.
				if err != nil {
					span.SetStatus(codes.Error, "rule evaluation failed")
					span.RecordError(err)
					return fmt.Errorf("server side expressions pipeline returned an error: %w", err)
				}

				// If the pipeline executed successfully but have other types of errors that can be retryable, we should do so.
				if !results.HasNonRetryableErrors() {
					span.SetStatus(codes.Error, "rule evaluation failed")
					span.RecordError(err)
					return fmt.Errorf("the result-set has errors that can be retried: %w", results.Error())
				}
			}

			// If results is nil, we assume that the error must be from the SSE pipeline (ruleEval.Evaluate) which is the only code that can actually return an `err`.
			if results == nil {
				results = append(results, eval.NewResultFromError(err, e.scheduledAt, dur))
			}

			// If err is nil, we assume that the SSS pipeline succeeded and that the error must be embedded in the results.
			if err == nil {
				err = results.Error()
			}

			span.SetStatus(codes.Error, "rule evaluation failed")
			span.RecordError(err)
		} else {
			logger.Debug("Alert rule evaluated", "results", results, "duration", dur)
			span.AddEvent("rule evaluated", trace.WithAttributes(
				attribute.Int64("results", int64(len(results))),
			))
		}
		start = sch.clock.Now()
		processedStates := sch.stateManager.ProcessEvalResults(
			ctx,
			e.scheduledAt,
			e.rule,
			results,
			state.GetRuleExtraLabels(logger, e.rule, e.folderTitle, !sch.disableGrafanaFolder),
		)
		processDuration.Observe(sch.clock.Now().Sub(start).Seconds())

		start = sch.clock.Now()
		alerts := state.FromStateTransitionToPostableAlerts(processedStates, sch.stateManager, sch.appURL)
		span.AddEvent("results processed", trace.WithAttributes(
			attribute.Int64("state_transitions", int64(len(processedStates))),
			attribute.Int64("alerts_to_send", int64(len(alerts.PostableAlerts))),
		))
		if len(alerts.PostableAlerts) > 0 {
			sch.alertsSender.Send(ctx, key, alerts)
		}
		sendDuration.Observe(sch.clock.Now().Sub(start).Seconds())

		return nil
	}

	evalRunning := false
	var currentFingerprint fingerprint
	defer sch.stopApplied(key)
	for {
		select {
		// used by external services (API) to notify that rule is updated.
		case ctx := <-updateCh:
			if currentFingerprint == ctx.Fingerprint {
				logger.Info("Rule's fingerprint has not changed. Skip resetting the state", "currentFingerprint", currentFingerprint)
				continue
			}

			logger.Info("Clearing the state of the rule because it was updated", "isPaused", ctx.IsPaused, "fingerprint", ctx.Fingerprint)
			// clear the state. So the next evaluation will start from the scratch.
			resetState(grafanaCtx, ctx.IsPaused)
			currentFingerprint = ctx.Fingerprint
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

				for attempt := int64(1); attempt <= sch.maxAttempts; attempt++ {
					isPaused := ctx.rule.IsPaused
					f := ruleWithFolder{ctx.rule, ctx.folderTitle}.Fingerprint()
					// Do not clean up state if the eval loop has just started.
					var needReset bool
					if currentFingerprint != 0 && currentFingerprint != f {
						logger.Debug("Got a new version of alert rule. Clear up the state", "fingerprint", f)
						needReset = true
					}
					// We need to reset state if the loop has started and the alert is already paused. It can happen,
					// if we have an alert with state and we do file provision with stateful Grafana, that state
					// lingers in DB and won't be cleaned up until next alert rule update.
					needReset = needReset || (currentFingerprint == 0 && isPaused)
					if needReset {
						resetState(grafanaCtx, isPaused)
					}
					currentFingerprint = f
					if isPaused {
						logger.Debug("Skip rule evaluation because it is paused")
						return
					}

					fpStr := currentFingerprint.String()
					utcTick := ctx.scheduledAt.UTC().Format(time.RFC3339Nano)
					tracingCtx, span := sch.tracer.Start(grafanaCtx, "alert rule execution", trace.WithAttributes(
						attribute.String("rule_uid", ctx.rule.UID),
						attribute.Int64("org_id", ctx.rule.OrgID),
						attribute.Int64("rule_version", ctx.rule.Version),
						attribute.String("rule_fingerprint", fpStr),
						attribute.String("tick", utcTick),
					))

					// Check before any execution if the context was cancelled so that we don't do any evaluations.
					if tracingCtx.Err() != nil {
						span.SetStatus(codes.Error, "rule evaluation cancelled")
						span.End()
						logger.Error("Skip evaluation and updating the state because the context has been cancelled", "version", ctx.rule.Version, "fingerprint", f, "attempt", attempt, "now", ctx.scheduledAt)
						return
					}

					retry := attempt < sch.maxAttempts
					err := evaluate(tracingCtx, f, attempt, ctx, span, retry)
					// This is extremely confusing - when we exhaust all retry attempts, or we have no retryable errors
					// we return nil - so technically, this is meaningless to know whether the evaluation has errors or not.
					span.End()
					if err == nil {
						return
					}

					logger.Error("Failed to evaluate rule", "version", ctx.rule.Version, "fingerprint", f, "attempt", attempt, "now", ctx.scheduledAt, "error", err)
					select {
					case <-tracingCtx.Done():
						logger.Error("Context has been cancelled while backing off", "version", ctx.rule.Version, "fingerprint", f, "attempt", attempt, "now", ctx.scheduledAt)
						return
					case <-time.After(retryDelay):
						continue
					}
				}
			}()

		case <-grafanaCtx.Done():
			// clean up the state only if the reason for stopping the evaluation loop is that the rule was deleted
			if errors.Is(grafanaCtx.Err(), errRuleDeleted) {
				// We do not want a context to be unbounded which could potentially cause a go routine running
				// indefinitely. 1 minute is an almost randomly chosen timeout, big enough to cover the majority of the
				// cases.
				ctx, cancelFunc := context.WithTimeout(context.Background(), time.Minute)
				defer cancelFunc()
				states := sch.stateManager.DeleteStateByRuleUID(ngmodels.WithRuleKey(ctx, key), key, ngmodels.StateReasonRuleDeleted)
				notify(states)
			}
			logger.Debug("Stopping alert rule routine")
			return nil
		}
	}
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

func SchedulerUserFor(orgID int64) *user.SignedInUser {
	return &user.SignedInUser{
		UserID:           -1,
		IsServiceAccount: true,
		Login:            "grafana_scheduler",
		OrgID:            orgID,
		OrgRole:          org.RoleAdmin,
		Permissions: map[int64]map[string][]string{
			orgID: {
				datasources.ActionQuery: []string{
					datasources.ScopeAll,
				},
			},
		},
	}
}
