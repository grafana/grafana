package schedule

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/alertmanager/api/v2/models"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// Rule represents a single piece of work that is executed periodically by the ruler.
type Rule interface {
	// Run creates the resources that will perform the rule's work, and starts it. It blocks indefinitely, until Stop is called or another signal is sent.
	Run() error
	// Stop shuts down the rule's execution with an optional reason. It has no effect if the rule has not yet been Run.
	Stop(reason error)
	// Eval sends a signal to execute the work represented by the rule, exactly one time.
	// It has no effect if the rule has not yet been Run, or if the rule is Stopped.
	Eval(eval *Evaluation) (bool, *Evaluation)
	// Update sends a singal to change the definition of the rule.
	Update(eval *Evaluation) bool
	// Type gives the type of the rule.
	Type() ngmodels.RuleType
	// Status indicates the status of the evaluating rule.
	Status() ngmodels.RuleStatus
	// Identifier returns the identifier of the rule.
	Identifier() ngmodels.AlertRuleKeyWithGroup
}

type ruleFactoryFunc func(context.Context, *ngmodels.AlertRule) Rule

func (f ruleFactoryFunc) new(ctx context.Context, rule *ngmodels.AlertRule) Rule {
	return f(ctx, rule)
}

func newRuleFactory(
	appURL *url.URL,
	disableGrafanaFolder bool,
	maxAttempts int64,
	sender AlertsSender,
	stateManager *state.Manager,
	evalFactory eval.EvaluatorFactory,
	clock clock.Clock,
	rrCfg setting.RecordingRuleSettings,
	met *metrics.Scheduler,
	logger log.Logger,
	tracer tracing.Tracer,
	recordingWriter RecordingWriter,
	evalAppliedHook evalAppliedFunc,
	stopAppliedHook stopAppliedFunc,
) ruleFactoryFunc {
	return func(ctx context.Context, rule *ngmodels.AlertRule) Rule {
		if rule.Type() == ngmodels.RuleTypeRecording {
			return newRecordingRule(
				ctx,
				rule.GetKeyWithGroup(),
				maxAttempts,
				clock,
				evalFactory,
				rrCfg,
				logger,
				met,
				tracer,
				recordingWriter,
				evalAppliedHook,
				stopAppliedHook,
			)
		}
		return newAlertRule(
			ctx,
			rule.GetKeyWithGroup(),
			appURL,
			disableGrafanaFolder,
			maxAttempts,
			sender,
			stateManager,
			evalFactory,
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

type alertRule struct {
	key ngmodels.AlertRuleKeyWithGroup

	evalCh   chan *Evaluation
	updateCh chan *Evaluation
	ctx      context.Context
	stopFn   util.CancelCauseFunc

	appURL               *url.URL
	disableGrafanaFolder bool
	maxAttempts          int64

	clock        clock.Clock
	sender       AlertsSender
	stateManager *state.Manager
	evalFactory  eval.EvaluatorFactory

	// Event hooks that are only used in tests.
	evalAppliedHook evalAppliedFunc
	stopAppliedHook stopAppliedFunc

	metrics *metrics.Scheduler
	logger  log.Logger
	tracer  tracing.Tracer
}

func newAlertRule(
	parent context.Context,
	key ngmodels.AlertRuleKeyWithGroup,
	appURL *url.URL,
	disableGrafanaFolder bool,
	maxAttempts int64,
	sender AlertsSender,
	stateManager *state.Manager,
	evalFactory eval.EvaluatorFactory,
	clock clock.Clock,
	met *metrics.Scheduler,
	logger log.Logger,
	tracer tracing.Tracer,
	evalAppliedHook func(ngmodels.AlertRuleKey, time.Time),
	stopAppliedHook func(ngmodels.AlertRuleKey),
) *alertRule {
	ctx, stop := util.WithCancelCause(ngmodels.WithRuleKey(parent, key.AlertRuleKey))
	return &alertRule{
		key:                  key,
		evalCh:               make(chan *Evaluation),
		updateCh:             make(chan *Evaluation),
		ctx:                  ctx,
		stopFn:               stop,
		appURL:               appURL,
		disableGrafanaFolder: disableGrafanaFolder,
		maxAttempts:          maxAttempts,
		clock:                clock,
		sender:               sender,
		stateManager:         stateManager,
		evalFactory:          evalFactory,
		evalAppliedHook:      evalAppliedHook,
		stopAppliedHook:      stopAppliedHook,
		metrics:              met,
		logger:               logger.FromContext(ctx),
		tracer:               tracer,
	}
}

func (a *alertRule) Identifier() ngmodels.AlertRuleKeyWithGroup {
	return a.key
}

func (a *alertRule) Type() ngmodels.RuleType {
	return ngmodels.RuleTypeAlerting
}

func (a *alertRule) Status() ngmodels.RuleStatus {
	return a.stateManager.GetStatusForRuleUID(a.key.OrgID, a.key.UID)
}

// eval signals the rule evaluation routine to perform the evaluation of the rule. Does nothing if the loop is stopped.
// Before sending a message into the channel, it does non-blocking read to make sure that there is no concurrent send operation.
// Returns a tuple where first element is
//   - true when message was sent
//   - false when the send operation is stopped
//
// the second element contains a dropped message that was sent by a concurrent sender.
func (a *alertRule) Eval(eval *Evaluation) (bool, *Evaluation) {
	if a.key.AlertRuleKey != eval.rule.GetKey() {
		// Make sure that rule has the same key. This should not happen
		panic(fmt.Sprintf("Invalid rule sent for evaluating. Expected rule key %s, got %s", a.key.AlertRuleKey, eval.rule.GetKey()))
	}
	// read the channel in unblocking manner to make sure that there is no concurrent send operation.
	var droppedMsg *Evaluation
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
func (a *alertRule) Update(eval *Evaluation) bool {
	// check if the channel is not empty.
	select {
	case <-a.updateCh:
	case <-a.ctx.Done():
		return false
	default:
	}

	select {
	case a.updateCh <- eval:
		return true
	case <-a.ctx.Done():
		return false
	}
}

// stop sends an instruction to the rule evaluation routine to shut down. an optional shutdown reason can be given.
func (a *alertRule) Stop(reason error) {
	if a.stopFn != nil {
		a.stopFn(reason)
	}
}

func (a *alertRule) Run() error {
	grafanaCtx := a.ctx
	a.logger.Debug("Alert rule routine started")

	var currentFingerprint fingerprint
	defer a.stopApplied()
	for {
		select {
		// used by external services (API) to notify that rule is updated.
		case ctx := <-a.updateCh:
			fp := ctx.Fingerprint()
			if currentFingerprint == fp {
				a.logger.Info("Rule's fingerprint has not changed. Skip resetting the state", "currentFingerprint", currentFingerprint)
				continue
			}

			a.logger.Info("Clearing the state of the rule because it was updated", "isPaused", ctx.rule.IsPaused, "fingerprint", fp)
			// clear the state. So the next evaluation will start from the scratch.
			a.resetState(grafanaCtx, ctx.rule, ctx.rule.IsPaused)
			currentFingerprint = fp
		// evalCh - used by the scheduler to signal that evaluation is needed.
		case ctx, ok := <-a.evalCh:
			if !ok {
				a.logger.Debug("Evaluation channel has been closed. Exiting")
				return nil
			}
			f := ctx.Fingerprint()
			logger := a.logger.New("version", ctx.rule.Version, "fingerprint", f, "now", ctx.scheduledAt)
			logger.Debug("Processing tick")

			func() {
				orgID := fmt.Sprint(a.key.OrgID)
				evalDuration := a.metrics.EvalDuration.WithLabelValues(orgID)
				evalTotal := a.metrics.EvalTotal.WithLabelValues(orgID)

				evalStart := a.clock.Now()
				defer func() {
					evalDuration.Observe(a.clock.Now().Sub(evalStart).Seconds())
					a.evalApplied(ctx.scheduledAt)
				}()

				for attempt := int64(1); attempt <= a.maxAttempts; attempt++ {
					isPaused := ctx.rule.IsPaused

					// Do not clean up state if the eval loop has just started.
					var needReset bool
					if currentFingerprint != 0 && currentFingerprint != f {
						logger.Debug("Got a new version of alert rule. Clear up the state", "current_fingerprint", currentFingerprint, "fingerprint", f)
						needReset = true
					}
					// We need to reset state if the loop has started and the alert is already paused. It can happen,
					// if we have an alert with state and we do file provision with stateful Grafana, that state
					// lingers in DB and won't be cleaned up until next alert rule update.
					needReset = needReset || (currentFingerprint == 0 && isPaused)
					if needReset {
						a.resetState(grafanaCtx, ctx.rule, isPaused)
					}
					currentFingerprint = f
					if isPaused {
						logger.Debug("Skip rule evaluation because it is paused")
						return
					}

					// Only increment evaluation counter once, not per-retry.
					if attempt == 1 {
						evalTotal.Inc()
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
					logger := logger.FromContext(tracingCtx)

					// Check before any execution if the context was cancelled so that we don't do any evaluations.
					if tracingCtx.Err() != nil {
						span.SetStatus(codes.Error, "rule evaluation cancelled")
						span.End()
						logger.Error("Skip evaluation and updating the state because the context has been cancelled", "version", ctx.rule.Version, "fingerprint", f, "attempt", attempt, "now", ctx.scheduledAt)
						return
					}
					retry := attempt < a.maxAttempts
					err := a.evaluate(tracingCtx, ctx, span, retry, logger)
					// This is extremely confusing - when we exhaust all retry attempts, or we have no retryable errors
					// we return nil - so technically, this is meaningless to know whether the evaluation has errors or not.
					span.End()
					if err == nil {
						logger.Debug("Tick processed", "attempt", attempt, "duration", a.clock.Now().Sub(evalStart))
						return
					}

					logger.Error("Failed to evaluate rule", "attempt", attempt, "error", err)
					select {
					case <-tracingCtx.Done():
						logger.Error("Context has been cancelled while backing off", "attempt", attempt)
						return
					case <-time.After(retryDelay):
						continue
					}
				}
			}()
			if ctx.afterEval != nil {
				logger.Debug("Calling afterEval")
				ctx.afterEval()
			}
		case <-grafanaCtx.Done():
			reason := grafanaCtx.Err()

			// We do not want a context to be unbounded which could potentially cause a go routine running
			// indefinitely. 1 minute is an almost randomly chosen timeout, big enough to cover the majority of the
			// cases.
			ctx, cancelFunc := context.WithTimeout(context.Background(), time.Minute)
			defer cancelFunc()

			if errors.Is(reason, errRuleDeleted) {
				// Clean up the state and send resolved notifications for firing alerts only if the reason for stopping
				// the evaluation loop is that the rule was deleted.
				stateTransitions := a.stateManager.DeleteStateByRuleUID(ngmodels.WithRuleKey(ctx, a.key.AlertRuleKey), a.key, ngmodels.StateReasonRuleDeleted)
				a.expireAndSend(grafanaCtx, stateTransitions)
			} else {
				// Otherwise, just clean up the cache.
				a.stateManager.ForgetStateByRuleUID(ngmodels.WithRuleKey(ctx, a.key.AlertRuleKey), a.key)
			}

			a.logger.Debug("Stopping alert rule routine", "reason", reason)
			return nil
		}
	}
}

func (a *alertRule) evaluate(ctx context.Context, e *Evaluation, span trace.Span, retry bool, logger log.Logger) error {
	orgID := fmt.Sprint(a.key.OrgID)
	evalAttemptTotal := a.metrics.EvalAttemptTotal.WithLabelValues(orgID)
	evalAttemptFailures := a.metrics.EvalAttemptFailures.WithLabelValues(orgID)
	evalTotalFailures := a.metrics.EvalFailures.WithLabelValues(orgID)
	processDuration := a.metrics.ProcessDuration.WithLabelValues(orgID)
	sendDuration := a.metrics.SendDuration.WithLabelValues(orgID)

	start := a.clock.Now()

	evalCtx := eval.NewContextWithPreviousResults(ctx, SchedulerUserFor(e.rule.OrgID), a.newLoadedMetricsReader(e.rule))
	ruleEval, err := a.evalFactory.Create(evalCtx, e.rule.GetEvalCondition().WithSource("scheduler").WithFolder(e.folderTitle))
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

	evalAttemptTotal.Inc()

	if ctx.Err() != nil { // check if the context is not cancelled. The evaluation can be a long-running task.
		span.SetStatus(codes.Error, "rule evaluation cancelled")
		logger.Debug("Skip updating the state because the context has been cancelled")
		return nil
	}

	if err != nil || results.HasErrors() {
		evalAttemptFailures.Inc()

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
		} else {
			// Only count the final attempt as a failure.
			evalTotalFailures.Inc()
		}

		// If results is nil, we assume that the error must be from the SSE pipeline (ruleEval.Evaluate) which is the only code that can actually return an `err`.
		if results == nil {
			results = append(results, eval.NewResultFromError(err, e.scheduledAt, dur))
		}

		// If err is nil, we assume that the SSS pipeline succeeded and that the error must be embedded in the results.
		if err == nil {
			err = results.Error()
		}

		logger.Debug("Alert rule evaluated", "error", err, "duration", dur)
		span.SetStatus(codes.Error, "rule evaluation failed")
		span.RecordError(err)
	} else {
		logger.Debug("Alert rule evaluated", "results", len(results), "duration", dur)
		span.AddEvent("rule evaluated", trace.WithAttributes(
			attribute.Int64("results", int64(len(results))),
		))
	}
	start = a.clock.Now()
	_ = a.stateManager.ProcessEvalResults(
		ctx,
		e.scheduledAt,
		e.rule,
		results,
		state.GetRuleExtraLabels(logger, e.rule, e.folderTitle, !a.disableGrafanaFolder),
		func(ctx context.Context, statesToSend state.StateTransitions) {
			start := a.clock.Now()
			alerts := a.send(ctx, logger, statesToSend)
			span.AddEvent("results sent", trace.WithAttributes(
				attribute.Int64("alerts_sent", int64(len(alerts.PostableAlerts))),
			))
			sendDuration.Observe(a.clock.Now().Sub(start).Seconds())
		},
	)
	processDuration.Observe(a.clock.Now().Sub(start).Seconds())

	return nil
}

// send sends alerts for the given state transitions.
func (a *alertRule) send(ctx context.Context, logger log.Logger, states state.StateTransitions) definitions.PostableAlerts {
	alerts := definitions.PostableAlerts{PostableAlerts: make([]models.PostableAlert, 0, len(states))}
	for _, alertState := range states {
		alerts.PostableAlerts = append(alerts.PostableAlerts, *state.StateToPostableAlert(alertState, a.appURL))
	}

	if len(alerts.PostableAlerts) > 0 {
		logger.Debug("Sending transitions to notifier", "transitions", len(alerts.PostableAlerts))
		a.sender.Send(ctx, a.key.AlertRuleKey, alerts)
	}
	return alerts
}

// sendExpire sends alerts to expire all previously firing alerts in the provided state transitions.
func (a *alertRule) expireAndSend(ctx context.Context, states []state.StateTransition) {
	expiredAlerts := state.FromAlertsStateToStoppedAlert(states, a.appURL, a.clock)
	if len(expiredAlerts.PostableAlerts) > 0 {
		a.sender.Send(ctx, a.key.AlertRuleKey, expiredAlerts)
	}
}

func (a *alertRule) resetState(ctx context.Context, rule *ngmodels.AlertRule, isPaused bool) {
	reason := ngmodels.StateReasonUpdated
	if isPaused {
		reason = ngmodels.StateReasonPaused
	}
	states := a.stateManager.ResetStateByRuleUID(ctx, rule, reason)
	a.expireAndSend(ctx, states)
}

// evalApplied is only used on tests.
func (a *alertRule) evalApplied(now time.Time) {
	if a.evalAppliedHook == nil {
		return
	}

	a.evalAppliedHook(a.key.AlertRuleKey, now)
}

// stopApplied is only used on tests.
func (a *alertRule) stopApplied() {
	if a.stopAppliedHook == nil {
		return
	}

	a.stopAppliedHook(a.key.AlertRuleKey)
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
				datasources.ActionRead: []string{
					datasources.ScopeAll,
				},
			},
		},
	}
}
