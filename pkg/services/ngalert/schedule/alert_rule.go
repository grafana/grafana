package schedule

import (
	context "context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ruleFactoryFunc func(context.Context) *alertRuleInfo

func (f ruleFactoryFunc) new(ctx context.Context) *alertRuleInfo {
	return f(ctx)
}

func newRuleFactory(
	appURL *url.URL,
	disableGrafanaFolder bool,
	maxAttempts int64,
	sender AlertsSender,
	stateManager *state.Manager,
	evalFactory eval.EvaluatorFactory,
	ruleProvider ruleProvider,
	clock clock.Clock,
	met *metrics.Scheduler,
	logger log.Logger,
	tracer tracing.Tracer,
	evalAppliedHook evalAppliedFunc,
	stopAppliedHook stopAppliedFunc,
) ruleFactoryFunc {
	return func(ctx context.Context) *alertRuleInfo {
		return newAlertRuleInfo(
			ctx,
			appURL,
			disableGrafanaFolder,
			maxAttempts,
			sender,
			stateManager,
			evalFactory,
			ruleProvider,
			clock,
			met,
			logger,
			tracer,
			evalAppliedHook,
			stopAppliedHook,
		)
	}
}

type evalAppliedFunc = func(ngmodels.AlertRuleKey, time.Time)
type stopAppliedFunc = func(ngmodels.AlertRuleKey)

type ruleProvider interface {
	get(ngmodels.AlertRuleKey) *ngmodels.AlertRule
}

type alertRuleInfo struct {
	evalCh   chan *evaluation
	updateCh chan ruleVersionAndPauseStatus
	ctx      context.Context
	stopFn   util.CancelCauseFunc

	appURL               *url.URL
	disableGrafanaFolder bool
	maxAttempts          int64

	clock        clock.Clock
	sender       AlertsSender
	stateManager *state.Manager
	evalFactory  eval.EvaluatorFactory
	ruleProvider ruleProvider

	// Event hooks that are only used in tests.
	evalAppliedHook evalAppliedFunc
	stopAppliedHook stopAppliedFunc

	metrics *metrics.Scheduler
	logger  log.Logger
	tracer  tracing.Tracer
}

func newAlertRuleInfo(
	parent context.Context,
	appURL *url.URL,
	disableGrafanaFolder bool,
	maxAttempts int64,
	sender AlertsSender,
	stateManager *state.Manager,
	evalFactory eval.EvaluatorFactory,
	ruleProvider ruleProvider,
	clock clock.Clock,
	met *metrics.Scheduler,
	logger log.Logger,
	tracer tracing.Tracer,
	evalAppliedHook func(ngmodels.AlertRuleKey, time.Time),
	stopAppliedHook func(ngmodels.AlertRuleKey),
) *alertRuleInfo {
	ctx, stop := util.WithCancelCause(parent)
	return &alertRuleInfo{
		evalCh:               make(chan *evaluation),
		updateCh:             make(chan ruleVersionAndPauseStatus),
		ctx:                  ctx,
		stopFn:               stop,
		appURL:               appURL,
		disableGrafanaFolder: disableGrafanaFolder,
		maxAttempts:          maxAttempts,
		clock:                clock,
		sender:               sender,
		stateManager:         stateManager,
		evalFactory:          evalFactory,
		ruleProvider:         ruleProvider,
		evalAppliedHook:      evalAppliedHook,
		stopAppliedHook:      stopAppliedHook,
		metrics:              met,
		logger:               logger,
		tracer:               tracer,
	}
}

// eval signals the rule evaluation routine to perform the evaluation of the rule. Does nothing if the loop is stopped.
// Before sending a message into the channel, it does non-blocking read to make sure that there is no concurrent send operation.
// Returns a tuple where first element is
//   - true when message was sent
//   - false when the send operation is stopped
//
// the second element contains a dropped message that was sent by a concurrent sender.
func (a *alertRuleInfo) eval(eval *evaluation) (bool, *evaluation) {
	// read the channel in unblocking manner to make sure that there is no concurrent send operation.
	var droppedMsg *evaluation
	select {
	case droppedMsg = <-a.evalCh:
	default:
	}

	select {
	case a.evalCh <- eval:
		return true, droppedMsg
	case <-a.ctx.Done():
		return false, droppedMsg
	}
}

// update sends an instruction to the rule evaluation routine to update the scheduled rule to the specified version. The specified version must be later than the current version, otherwise no update will happen.
func (a *alertRuleInfo) update(lastVersion ruleVersionAndPauseStatus) bool {
	// check if the channel is not empty.
	select {
	case <-a.updateCh:
	case <-a.ctx.Done():
		return false
	default:
	}

	select {
	case a.updateCh <- lastVersion:
		return true
	case <-a.ctx.Done():
		return false
	}
}

// stop sends an instruction to the rule evaluation routine to shut down. an optional shutdown reason can be given.
func (a *alertRuleInfo) stop(reason error) {
	a.stopFn(reason)
}

//nolint:gocyclo
func (a *alertRuleInfo) run(key ngmodels.AlertRuleKey) error {
	grafanaCtx := ngmodels.WithRuleKey(a.ctx, key)
	logger := a.logger.FromContext(grafanaCtx)
	logger.Debug("Alert rule routine started")

	orgID := fmt.Sprint(key.OrgID)
	evalTotal := a.metrics.EvalTotal.WithLabelValues(orgID)
	evalDuration := a.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotalFailures := a.metrics.EvalFailures.WithLabelValues(orgID)
	processDuration := a.metrics.ProcessDuration.WithLabelValues(orgID)
	sendDuration := a.metrics.SendDuration.WithLabelValues(orgID)

	notify := func(states []state.StateTransition) {
		expiredAlerts := state.FromAlertsStateToStoppedAlert(states, a.appURL, a.clock)
		if len(expiredAlerts.PostableAlerts) > 0 {
			a.sender.Send(grafanaCtx, key, expiredAlerts)
		}
	}

	resetState := func(ctx context.Context, isPaused bool) {
		rule := a.ruleProvider.get(key)
		reason := ngmodels.StateReasonUpdated
		if isPaused {
			reason = ngmodels.StateReasonPaused
		}
		states := a.stateManager.ResetStateByRuleUID(ctx, rule, reason)
		notify(states)
	}

	evaluate := func(ctx context.Context, f fingerprint, attempt int64, e *evaluation, span trace.Span, retry bool) error {
		logger := logger.New("version", e.rule.Version, "fingerprint", f, "attempt", attempt, "now", e.scheduledAt).FromContext(ctx)
		start := a.clock.Now()

		evalCtx := eval.NewContextWithPreviousResults(ctx, SchedulerUserFor(e.rule.OrgID), a.newLoadedMetricsReader(e.rule))
		ruleEval, err := a.evalFactory.Create(evalCtx, e.rule.GetEvalCondition())
		var results eval.Results
		var dur time.Duration
		if err != nil {
			dur = a.clock.Now().Sub(start)
			logger.Error("Failed to build rule evaluator", "error", err)
		} else {
			results, err = ruleEval.Evaluate(ctx, e.scheduledAt)
			dur = a.clock.Now().Sub(start)
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
		start = a.clock.Now()
		processedStates := a.stateManager.ProcessEvalResults(
			ctx,
			e.scheduledAt,
			e.rule,
			results,
			state.GetRuleExtraLabels(logger, e.rule, e.folderTitle, !a.disableGrafanaFolder),
		)
		processDuration.Observe(a.clock.Now().Sub(start).Seconds())

		start = a.clock.Now()
		alerts := state.FromStateTransitionToPostableAlerts(processedStates, a.stateManager, a.appURL)
		span.AddEvent("results processed", trace.WithAttributes(
			attribute.Int64("state_transitions", int64(len(processedStates))),
			attribute.Int64("alerts_to_send", int64(len(alerts.PostableAlerts))),
		))
		if len(alerts.PostableAlerts) > 0 {
			a.sender.Send(ctx, key, alerts)
		}
		sendDuration.Observe(a.clock.Now().Sub(start).Seconds())

		return nil
	}

	evalRunning := false
	var currentFingerprint fingerprint
	defer a.stopApplied(key)
	for {
		select {
		// used by external services (API) to notify that rule is updated.
		case ctx := <-a.updateCh:
			if currentFingerprint == ctx.Fingerprint {
				logger.Info("Rule's fingerprint has not changed. Skip resetting the state", "currentFingerprint", currentFingerprint)
				continue
			}

			logger.Info("Clearing the state of the rule because it was updated", "isPaused", ctx.IsPaused, "fingerprint", ctx.Fingerprint)
			// clear the state. So the next evaluation will start from the scratch.
			resetState(grafanaCtx, ctx.IsPaused)
			currentFingerprint = ctx.Fingerprint
		// evalCh - used by the scheduler to signal that evaluation is needed.
		case ctx, ok := <-a.evalCh:
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
					a.evalApplied(key, ctx.scheduledAt)
				}()

				for attempt := int64(1); attempt <= a.maxAttempts; attempt++ {
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
					tracingCtx, span := a.tracer.Start(grafanaCtx, "alert rule execution", trace.WithAttributes(
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

					retry := attempt < a.maxAttempts
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
				states := a.stateManager.DeleteStateByRuleUID(ngmodels.WithRuleKey(ctx, key), key, ngmodels.StateReasonRuleDeleted)
				notify(states)
			}
			logger.Debug("Stopping alert rule routine")
			return nil
		}
	}
}

// evalApplied is only used on tests.
func (a *alertRuleInfo) evalApplied(alertDefKey ngmodels.AlertRuleKey, now time.Time) {
	if a.evalAppliedHook == nil {
		return
	}

	a.evalAppliedHook(alertDefKey, now)
}

// stopApplied is only used on tests.
func (a *alertRuleInfo) stopApplied(alertDefKey ngmodels.AlertRuleKey) {
	if a.stopAppliedHook == nil {
		return
	}

	a.stopAppliedHook(alertDefKey)
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
