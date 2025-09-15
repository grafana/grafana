package schedule

import (
	context "context"
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/atomic"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	historianModels "github.com/grafana/grafana/pkg/services/ngalert/schedule/historian/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type RuleStatus struct {
	Health              string
	LastError           error
	EvaluationTimestamp time.Time
	EvaluationDuration  time.Duration
}

type recordingRule struct {
	key ngmodels.AlertRuleKeyWithGroup

	ctx                 context.Context
	evalCh              chan *Evaluation
	stopFn              util.CancelCauseFunc
	health              *atomic.String
	lastError           *atomic.Error
	evaluationTimestamp *atomic.Time
	evaluationDuration  *atomic.Duration

	retryConfig RetryConfig

	clock       clock.Clock
	evalFactory eval.EvaluatorFactory
	cfg         setting.RecordingRuleSettings
	writer      RecordingWriter

	// Event hooks that are only used in tests.
	evalAppliedHook evalAppliedFunc
	stopAppliedHook stopAppliedFunc

	logger    log.Logger
	metrics   *metrics.Scheduler
	tracer    tracing.Tracer
	historian Historian
}

func newRecordingRule(
	parent context.Context,
	key ngmodels.AlertRuleKeyWithGroup,
	retryConfig RetryConfig,
	clock clock.Clock,
	evalFactory eval.EvaluatorFactory,
	cfg setting.RecordingRuleSettings,
	logger log.Logger,
	metrics *metrics.Scheduler,
	tracer tracing.Tracer,
	writer RecordingWriter,
	evalAppliedHook evalAppliedFunc,
	stopAppliedHook stopAppliedFunc,
	historian Historian,
) *recordingRule {
	ctx, stop := util.WithCancelCause(ngmodels.WithRuleKey(parent, key.AlertRuleKey))
	return &recordingRule{
		key:                 key,
		ctx:                 ctx,
		evalCh:              make(chan *Evaluation),
		stopFn:              stop,
		health:              atomic.NewString("unknown"),
		lastError:           atomic.NewError(nil),
		evaluationTimestamp: atomic.NewTime(time.Time{}),
		evaluationDuration:  atomic.NewDuration(0),
		clock:               clock,
		evalFactory:         evalFactory,
		cfg:                 cfg,
		retryConfig:         retryConfig,
		evalAppliedHook:     evalAppliedHook,
		stopAppliedHook:     stopAppliedHook,
		logger:              logger.FromContext(ctx),
		metrics:             metrics,
		tracer:              tracer,
		writer:              writer,
		historian:           historian,
	}
}

func (r *recordingRule) Identifier() ngmodels.AlertRuleKeyWithGroup {
	return r.key
}

func (r *recordingRule) Type() ngmodels.RuleType {
	return ngmodels.RuleTypeRecording
}

func (r *recordingRule) Status() ngmodels.RuleStatus {
	return ngmodels.RuleStatus{
		Health:              r.health.Load(),
		LastError:           r.lastError.Load(),
		EvaluationTimestamp: r.evaluationTimestamp.Load(),
		EvaluationDuration:  r.evaluationDuration.Load(),
	}
}

func (r *recordingRule) Eval(eval *Evaluation) (bool, *Evaluation) {
	// read the channel in unblocking manner to make sure that there is no concurrent send operation.
	var droppedMsg *Evaluation
	select {
	case droppedMsg = <-r.evalCh:
	default:
	}

	select {
	case r.evalCh <- eval:
		return true, droppedMsg
	case <-r.ctx.Done():
		return false, droppedMsg
	}
}

func (r *recordingRule) Update(_ *Evaluation) bool {
	return true
}

func (r *recordingRule) Stop(reason error) {
	if r.stopFn != nil {
		r.stopFn(reason)
	}
}

func (r *recordingRule) Run() error {
	ctx := r.ctx
	r.logger.Debug("Recording rule routine started")

	defer r.stopApplied()

	for {
		select {
		case eval, ok := <-r.evalCh:
			if !ok {
				r.logger.Debug("Evaluation channel has been closed. Exiting")
				return nil
			}
			if !r.cfg.Enabled {
				r.logger.Warn("Recording rule scheduled but subsystem is not enabled. Skipping")
				return nil
			}
			// TODO: Skipping the "evalRunning" guard that the alert rule routine does, because it seems to be dead code and impossible to hit.
			// TODO: Either implement me or remove from alert rules once investigated.

			r.doEvaluate(ctx, eval)
			// Call afterEval callback if it exists
			if eval.afterEval != nil {
				eval.afterEval()
			}
		case <-ctx.Done():
			r.logger.Debug("Stopping recording rule routine")
			return nil
		}
	}
}

func (r *recordingRule) doEvaluate(ctx context.Context, ev *Evaluation) {
	logger := r.logger.FromContext(ctx).New("now", ev.scheduledAt, "fingerprint", ev.Fingerprint())
	orgID := fmt.Sprint(ev.rule.OrgID)
	evalDuration := r.metrics.EvalDuration.WithLabelValues(orgID)
	evalAttemptTotal := r.metrics.EvalAttemptTotal.WithLabelValues(orgID)
	evalAttemptFailures := r.metrics.EvalAttemptFailures.WithLabelValues(orgID)
	evalTotal := r.metrics.EvalTotal.WithLabelValues(orgID)
	evalTotalFailures := r.metrics.EvalFailures.WithLabelValues(orgID)
	evalStart := r.clock.Now()

	defer func() {
		evalTotal.Inc()
		end := r.clock.Now()
		dur := end.Sub(evalStart)
		evalDuration.Observe(dur.Seconds())
		r.evaluationTimestamp.Store(end)
		r.evaluationDuration.Store(dur)

		r.evaluationDoneTestHook(ev)
	}()

	if ev.rule.IsPaused {
		logger.Debug("Skip recording rule evaluation because it is paused")
		return
	}

	tracingCtx, span := r.tracer.Start(ctx, "recording rule execution", trace.WithAttributes(
		attribute.String("rule_uid", ev.rule.UID),
		attribute.Int64("org_id", ev.rule.OrgID),
		attribute.Int64("rule_version", ev.rule.Version),
		attribute.String("rule_fingerprint", ev.Fingerprint().String()),
		attribute.String("tick", ev.scheduledAt.UTC().Format(time.RFC3339Nano)),
	))
	defer span.End()

	retryer := newExponentialBackoffRetryer(
		r.retryConfig.MaxAttempts-1, // first attempt is not a retry
		r.retryConfig.InitialRetryDelay,
		r.retryConfig.MaxRetryDelay,
		r.retryConfig.RandomizationFactor,
		r.clock,
	)
	attempt := 1

	var latestError error
	for {
		logger := logger.New("attempt", attempt)
		if ctx.Err() != nil {
			span.SetStatus(codes.Error, "rule evaluation cancelled")
			logger.Error("Skipping recording rule evaluation because context has been cancelled")
			return
		}

		evalAttemptTotal.Inc()
		start := r.clock.Now()
		status, err := r.tryEvaluation(tracingCtx, ev, logger)
		latestError = err

		if r.historian != nil {
			duration := r.clock.Since(start)
			statusErr := ""
			if err != nil {
				statusErr = err.Error()
			}
			go r.historian.Record(ctx, historianModels.Record{
				RuleUID:         ev.rule.UID,
				RuleVersion:     ev.rule.Version,
				GroupKey:        ev.rule.GetGroupKey(),
				RuleFingerprint: ev.Fingerprint().String(),
				Tick:            ev.scheduledAt,
				Attempt:         attempt,
				Status:          status,
				Error:           statusErr,
				Duration:        duration,
				EvaluationTime:  start,
			})
		}

		if err == nil {
			break
		}

		logger.Error("Failed to evaluate rule", "attempt", attempt, "error", err)
		evalAttemptFailures.Inc()

		if eval.IsNonRetryableError(err) {
			break
		}

		retryIn := retryer.NextAttemptIn()
		if retryIn == retryStop {
			logger.Error("Recording rule evaluation failed after all attempts", "lastError", latestError)
			break
		}

		attempt++

		select {
		case <-tracingCtx.Done():
			logger.Error("Context has been cancelled while backing off", "attempt", attempt)
			return
		case <-r.clock.After(retryIn):
			continue
		}
	}

	if latestError != nil {
		evalTotalFailures.Inc()
		span.SetStatus(codes.Error, "rule evaluation failed")
		span.RecordError(latestError)
		r.lastError.Store(latestError)
		r.health.Store("error")
		return
	}
	logger.Debug("Recording rule evaluation succeeded")
	span.AddEvent("rule evaluated")
	r.lastError.Store(nil)
	r.health.Store("ok")
}

func (r *recordingRule) tryEvaluation(ctx context.Context, ev *Evaluation, logger log.Logger) (historianModels.EvalStatus, error) {
	evalStart := r.clock.Now()
	evalCtx := eval.NewContext(ctx, SchedulerUserFor(ev.rule.OrgID))
	result, err := r.buildAndExecutePipeline(ctx, evalCtx, ev, logger)
	evalDur := r.clock.Now().Sub(evalStart)
	if err != nil {
		return historianModels.EvalStatusEvalError, fmt.Errorf("server side expressions pipeline returned an error: %w", err)
	}

	// There might be errors in the pipeline results, even if the query succeeded.
	if err := eval.FindConditionError(result, ev.rule.Record.From); err != nil {
		return historianModels.EvalStatusEvalError, fmt.Errorf("the query failed with an error: %w", err)
	}
	// TODO: This is missing dedicated logic for NoData. If NoData we can skip the write.

	logger.Debug("Recording rule query completed", "resultCount", len(result.Responses), "duration", evalDur)
	span := trace.SpanFromContext(ctx)
	span.AddEvent("query succeeded", trace.WithAttributes(
		attribute.Int64("results", int64(len(result.Responses))),
	))

	frames, err := r.frameRef(ev.rule.Record.From, result)
	if err != nil {
		span.AddEvent("query returned no data, nothing to write", trace.WithAttributes(
			attribute.String("reason", err.Error()),
		))
		logger.Debug("Query returned no data", "reason", err)
		r.health.Store("nodata")
		return historianModels.EvalStatusNoData, nil
	}

	filteredLabels := ngmodels.WithoutPrivateLabels(ev.rule.Labels)
	writeStart := r.clock.Now()
	err = r.writer.WriteDatasource(ctx, ev.rule.Record.TargetDatasourceUID, ev.rule.Record.Metric, ev.scheduledAt, frames, ev.rule.OrgID, filteredLabels)
	writeDur := r.clock.Now().Sub(writeStart)

	if err != nil {
		span.SetStatus(codes.Error, "failed to write metrics")
		span.RecordError(err)
		return historianModels.EvalStatusProcessError, fmt.Errorf("remote write failed: %w", err)
	}

	logger.Debug("Metrics written", "duration", writeDur)
	span.AddEvent("metrics written", trace.WithAttributes(
		attribute.Int64("frames", int64(len(frames))),
	))

	return historianModels.EvalStatusSuccess, nil
}

func (r *recordingRule) buildAndExecutePipeline(ctx context.Context, evalCtx eval.EvaluationContext, ev *Evaluation, logger log.Logger) (*backend.QueryDataResponse, error) {
	start := r.clock.Now()
	evaluator, err := r.evalFactory.Create(evalCtx, ev.rule.GetEvalCondition().WithSource("scheduler").WithFolder(ev.folderTitle))
	if err != nil {
		logger.Error("Failed to build rule evaluator", "error", err)
		return nil, err
	}
	results, err := evaluator.EvaluateRaw(ctx, ev.scheduledAt)
	if err != nil {
		logger.Error("Failed to evaluate rule", "error", err, "duration", r.clock.Now().Sub(start))
	}
	return results, err
}

func (r *recordingRule) evaluationDoneTestHook(ev *Evaluation) {
	if r.evalAppliedHook == nil {
		return
	}

	r.evalAppliedHook(r.key.AlertRuleKey, ev.scheduledAt)
}

// frameRef gets frames from a QueryDataResponse for a particular refID. It returns an error if the frames do not exist or have no data.
func (r *recordingRule) frameRef(refID string, resp *backend.QueryDataResponse) (data.Frames, error) {
	if len(resp.Responses) == 0 {
		return nil, fmt.Errorf("no responses returned from rule evaluation")
	}

	targetNode, ok := resp.Responses[refID]
	if !ok {
		return nil, fmt.Errorf("no response with refID %s found in rule evaluation", refID)
	}

	if eval.IsNoData(targetNode) {
		return nil, fmt.Errorf("response with refID %s has no data", refID)
	}

	return targetNode.Frames, nil
}

// stopApplied is only used on tests.
func (r *recordingRule) stopApplied() {
	if r.stopAppliedHook == nil {
		return
	}

	r.stopAppliedHook(r.key.AlertRuleKey)
}
