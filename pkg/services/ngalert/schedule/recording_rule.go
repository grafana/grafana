package schedule

import (
	context "context"
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

type recordingRule struct {
	ctx    context.Context
	evalCh chan *Evaluation
	stopFn util.CancelCauseFunc

	maxAttempts int64

	clock       clock.Clock
	evalFactory eval.EvaluatorFactory

	logger  log.Logger
	metrics *metrics.Scheduler
}

func newRecordingRule(parent context.Context, maxAttempts int64, clock clock.Clock, evalFactory eval.EvaluatorFactory, logger log.Logger, metrics *metrics.Scheduler) *recordingRule {
	ctx, stop := util.WithCancelCause(parent)
	return &recordingRule{
		ctx:         ctx,
		evalCh:      make(chan *Evaluation),
		stopFn:      stop,
		clock:       clock,
		evalFactory: evalFactory,
		maxAttempts: maxAttempts,
		logger:      logger,
		metrics:     metrics,
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

func (r *recordingRule) Update(lastVersion RuleVersionAndPauseStatus) bool {
	return true
}

func (r *recordingRule) Stop(reason error) {
	if r.stopFn != nil {
		r.stopFn(reason)
	}
}

func (r *recordingRule) Run(key ngmodels.AlertRuleKey) error {
	ctx := ngmodels.WithRuleKey(r.ctx, key)
	logger := r.logger.FromContext(ctx)
	logger.Debug("Recording rule routine started")

	// nolint:gosimple
	for {
		select {
		case eval, ok := <-r.evalCh:
			if !ok {
				logger.Debug("Evaluation channel has been closed. Exiting")
				return nil
			}
			// TODO: evalRunning shed inprogress?

			r.doEvaluate(ctx, eval)
		case <-ctx.Done():
			logger.Debug("Stopping recording rule routine")
			return nil
		}
	}
}

func (r *recordingRule) doEvaluate(ctx context.Context, ev *Evaluation) {
	// TODO: Fingerprint or other things in log context
	logger := r.logger.FromContext(ctx).New("now", ev.scheduledAt)
	orgID := fmt.Sprint(ev.rule.OrgID)
	evalDuration := r.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotal := r.metrics.EvalTotal.WithLabelValues(orgID)
	// TODO: evalRunning
	evalStart := r.clock.Now()

	defer func() {
		evalTotal.Inc()
		evalDuration.Observe(r.clock.Now().Sub(evalStart).Seconds())
	}()

	if ev.rule.IsPaused {
		logger.Debug("Skip recording rule evaluation because it is paused")
	}

	// TODO: tracing

	for attempt := int64(1); attempt <= r.maxAttempts; attempt++ {
		logger := logger.New("attempt", attempt)
		if ctx.Err() != nil {
			logger.Error("Skipping recording rule evaluation because context has been cancelled")
			return
		}

		err := r.tryEvaluate(ctx, ev, logger)
		if err == nil {
			return
		}

		logger.Error("Failed to evaluate rule", "attempt", attempt, "error", err)
		select {
		case <-ctx.Done():
			logger.Error("Context has been cancelled while backing off", "attempt", attempt)
			return
		case <-time.After(retryDelay):
			continue
		}
	}
}

func (r *recordingRule) tryEvaluate(ctx context.Context, ev *Evaluation, logger log.Logger) error {
	orgID := fmt.Sprint(ev.rule.OrgID)
	evalAttemptTotal := r.metrics.EvalAttemptTotal.WithLabelValues(orgID)
	evalAttemptFailures := r.metrics.EvalAttemptFailures.WithLabelValues(orgID)
	evalTotalFailures := r.metrics.EvalFailures.WithLabelValues(orgID)

	start := r.clock.Now()
	evalCtx := eval.NewContext(ctx, SchedulerUserFor(ev.rule.OrgID))
	result, err := r.buildAndExecutePipeline(ctx, evalCtx, ev, logger)
	dur := r.clock.Now().Sub(start)

	evalAttemptTotal.Inc()

	// TODO: In some cases, err can be nil but the dataframe itself contains embedded error frames. Parse these out like we do when evaluating alert rules.
	if err != nil {
		evalAttemptFailures.Inc()
		// TODO: Only errors embedded in the frame can be considered retryable.
		// TODO: Since we are not handling these yet per the above TODO, we can blindly consider all errors to be non-retryable for now, and just exit.
		evalTotalFailures.Inc()
		return fmt.Errorf("server side expressions pipeline returned an error: %w")
	}

	logger.Debug("Alert rule evaluated", "results", result, "duration", dur)
	return nil
}

func (r *recordingRule) buildAndExecutePipeline(ctx context.Context, evalCtx eval.EvaluationContext, ev *Evaluation, logger log.Logger) (*backend.QueryDataResponse, error) {
	start := r.clock.Now()
	evaluator, err := r.evalFactory.Create(evalCtx, ev.rule.GetEvalCondition())
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
