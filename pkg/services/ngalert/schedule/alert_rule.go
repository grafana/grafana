package schedule

import (
	"context"
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
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type evalSignal struct {
	tick        time.Time
	folderTitle string
}

type alertRule struct {
	rule        *ngmodels.AlertRule
	key         ngmodels.AlertRuleKey
	folderCache folderCache
	hash        fingerprint
	fingerprint fingerprint

	appURL               *url.URL
	disableGrafanaFolder bool
	maxAttempts          int64

	clock        clock.Clock
	sender       AlertsSender
	stateManager *state.Manager
	evalFactory  eval.EvaluatorFactory

	metrics *metrics.Scheduler
	logger  log.Logger
	tracer  tracing.Tracer
}

func newAlertRule(
	parent context.Context,
	rule *ngmodels.AlertRule,
	fingerprint fingerprint,
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
) *alertRule {
	ctx := ngmodels.WithRuleKey(parent, rule.GetKey())
	return &alertRule{
		rule:                 rule,
		key:                  rule.GetKey(),
		hash:                 hashRule(rule),
		fingerprint:          fingerprint,
		appURL:               appURL,
		disableGrafanaFolder: disableGrafanaFolder,
		maxAttempts:          maxAttempts,
		clock:                clock,
		sender:               sender,
		stateManager:         stateManager,
		evalFactory:          evalFactory,
		metrics:              met,
		logger:               logger.FromContext(ctx),
		tracer:               tracer,
	}
}

func (a *alertRule) Type() ngmodels.RuleType {
	return ngmodels.RuleTypeAlerting
}

func (a *alertRule) doEval(ctx context.Context, tick time.Time, folderTitle string) {
	eval := &Evaluation{
		rule:        a.rule,
		scheduledAt: tick,
		folderTitle: folderTitle,
	}
	a.doEvaluate(ctx, eval)
}

func (a *alertRule) doEvaluate(grafanaCtx context.Context, eval *Evaluation) {
	f := eval.Fingerprint()
	logger := a.logger.New("version", eval.rule.Version, "fingerprint", f, "now", eval.scheduledAt)
	logger.Debug("Processing tick")

	orgID := fmt.Sprint(a.key.OrgID)
	evalDuration := a.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotal := a.metrics.EvalTotal.WithLabelValues(orgID)

	evalStart := a.clock.Now()
	defer func() {
		evalDuration.Observe(a.clock.Now().Sub(evalStart).Seconds())
	}()

	for attempt := int64(1); attempt <= a.maxAttempts; attempt++ {
		isPaused := eval.rule.IsPaused
		currentFp := a.fingerprint

		// Do not clean up state if the eval loop has just started.
		var needReset bool
		if currentFp != 0 && currentFp != f {
			logger.Debug("Got a new version of alert rule. Clear up the state", "current_fingerprint", currentFp, "fingerprint", f)
			needReset = true
		}
		// We need to reset state if the loop has started and the alert is already paused. It can happen,
		// if we have an alert with state and we do file provision with stateful Grafana, that state
		// lingers in DB and won't be cleaned up until next alert rule update.
		needReset = needReset || (currentFp == 0 && isPaused)
		if needReset {
			a.resetState(grafanaCtx, isPaused)
		}
		a.fingerprint = f
		if isPaused {
			logger.Debug("Skip rule evaluation because it is paused")
			return
		}

		// Only increment evaluation counter once, not per-retry.
		if attempt == 1 {
			evalTotal.Inc()
		}

		fpStr := currentFp.String()
		utcTick := eval.scheduledAt.UTC().Format(time.RFC3339Nano)
		tracingCtx, span := a.tracer.Start(grafanaCtx, "alert rule execution", trace.WithAttributes(
			attribute.String("rule_uid", eval.rule.UID),
			attribute.Int64("org_id", eval.rule.OrgID),
			attribute.Int64("rule_version", eval.rule.Version),
			attribute.String("rule_fingerprint", fpStr),
			attribute.String("tick", utcTick),
		))

		// Check before any execution if the context was cancelled so that we don't do any evaluations.
		if tracingCtx.Err() != nil {
			span.SetStatus(codes.Error, "rule evaluation cancelled")
			span.End()
			logger.Error("Skip evaluation and updating the state because the context has been cancelled", "version", eval.rule.Version, "fingerprint", fpStr, "attempt", attempt, "now", eval.scheduledAt)
			return
		}
		retry := attempt < a.maxAttempts
		err := a.tryEvaluation(tracingCtx, eval, span, retry, logger)
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
}

func (a *alertRule) tryEvaluation(ctx context.Context, e *Evaluation, span trace.Span, retry bool, logger log.Logger) error {
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
		logger.Debug("Alert rule evaluated", "results", results, "duration", dur)
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
		a.sender.Send(ctx, a.key, alerts)
	}
	return alerts
}

// sendExpire sends alerts to expire all previously firing alerts in the provided state transitions.
func (a *alertRule) expireAndSend(ctx context.Context, states []state.StateTransition) {
	expiredAlerts := state.FromAlertsStateToStoppedAlert(states, a.appURL, a.clock)
	if len(expiredAlerts.PostableAlerts) > 0 {
		a.sender.Send(ctx, a.key, expiredAlerts)
	}
}

func (a *alertRule) resetState(ctx context.Context, isPaused bool) {
	reason := ngmodels.StateReasonUpdated
	if isPaused {
		reason = ngmodels.StateReasonPaused
	}
	states := a.stateManager.ResetStateByRuleUID(ctx, a.rule, reason)
	a.expireAndSend(ctx, states)
}

func (a *alertRule) getKey() ngmodels.AlertRuleKey {
	return a.key
}

func (a *alertRule) getHash() fingerprint {
	return a.hash
}
