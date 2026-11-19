package schedule

import (
	context "context"
	"errors"
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
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// Same bound as alert rules use when they clean up after their context is cancelled.
const staleOnStopTimeout = time.Minute

type RuleStatus struct {
	Health              string
	LastError           error
	EvaluationTimestamp time.Time
	EvaluationDuration  time.Duration
}

// SeriesBudget caps how many series recording rules remember for stale markers.
// state.SeriesBudget implements it.
type SeriesBudget interface {
	// Admit reserves room for one series and reports whether there was any.
	Admit() bool
	// Release gives back room for n series.
	Release(n int)
}

type unlimitedBudget struct{}

func (unlimitedBudget) Admit() bool { return true }
func (unlimitedBudget) Release(int) {}

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

	// Series from the last successful evaluation, to stale the ones that go missing.
	// Every series in it, and only those, holds one slot of budget, so held is its size
	// and the budget's use is the sum of held over all rules sharing it. Change written
	// only through commitWritten and untrack, so the two cannot drift.
	written writtenSeries
	held    int
	budget  SeriesBudget
	// Latest tick an evaluation started for, whether or not it wrote. Only touched from Run.
	lastTick time.Time

	// Event hooks that are only used in tests.
	evalAppliedHook evalAppliedFunc
	stopAppliedHook stopAppliedFunc

	logger  log.Logger
	metrics *metrics.Scheduler
	tracer  tracing.Tracer
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
	budget SeriesBudget,
	evalAppliedHook evalAppliedFunc,
	stopAppliedHook stopAppliedFunc,
) *recordingRule {
	ctx, stop := util.WithCancelCause(ngmodels.WithRuleKey(parent, key.AlertRuleKey))
	if budget == nil {
		budget = unlimitedBudget{}
	}

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
		budget:              budget,
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
	// The closure reads written at exit: it is replaced on every evaluation.
	defer func() { r.untrack(r.written) }()

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
			r.staleOnStop(ctx)
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
	r.lastTick = ev.scheduledAt

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
		r.markStale(ctx, markerBefore(ev.scheduledAt), logger)
		return
	}

	ctx, span := r.tracer.Start(ctx, "recording rule execution", trace.WithAttributes(
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
		err := r.tryEvaluation(ctx, ev, logger)
		latestError = err
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
		case <-ctx.Done():
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

func (r *recordingRule) tryEvaluation(ctx context.Context, ev *Evaluation, logger log.Logger) error {
	evalStart := r.clock.Now()
	evalCtx := eval.NewContext(ctx, SchedulerUserFor(ev.rule.OrgID))
	result, err := r.buildAndExecutePipeline(ctx, evalCtx, ev, logger)
	evalDur := r.clock.Now().Sub(evalStart)
	if err != nil {
		return fmt.Errorf("server side expressions pipeline returned an error: %w", err)
	}

	// There might be errors in the pipeline results, even if the query succeeded.
	if err := eval.FindConditionError(result, ev.rule.Record.From); err != nil {
		return fmt.Errorf("the query failed with an error: %w", err)
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
		// A response we could not read says nothing about the series, so keep them.
		if errors.Is(err, errNoData) {
			r.markStale(ctx, markerBefore(ev.scheduledAt), logger)
		}
		return nil
	}

	filteredLabels := ngmodels.WithoutPrivateLabels(ev.rule.Labels)

	// Markers go first: they are written one ms before the sample, so a marker for a series
	// that is output again is overridden by the sample instead of conflicting with it.
	var current writtenSeries
	points, pointsErr := writer.PointsFromFrames(ev.rule.Record.Metric, ev.scheduledAt, frames, filteredLabels)
	if pointsErr != nil {
		logger.Warn("Failed to read series, stale markers are not tracked for this evaluation", "error", pointsErr)
	} else {
		current = newWrittenSeries(ev.rule.Record.TargetDatasourceUID, ev.rule.OrgID, ev.rule.Record.Metric, points)
		r.writeStale(ctx, markerBefore(ev.scheduledAt), current, logger)
	}

	writeStart := r.clock.Now()
	err = r.writer.WriteDatasource(ctx, ev.rule.Record.TargetDatasourceUID, ev.rule.Record.Metric, ev.scheduledAt, frames, ev.rule.OrgID, filteredLabels)
	writeDur := r.clock.Now().Sub(writeStart)

	if err != nil {
		span.SetStatus(codes.Error, "failed to write metrics")
		span.RecordError(err)
		return fmt.Errorf("remote write failed: %w", err)
	}

	logger.Debug("Metrics written", "duration", writeDur)
	span.AddEvent("metrics written", trace.WithAttributes(
		attribute.Int64("frames", int64(len(frames))),
	))

	if pointsErr == nil {
		r.commitWritten(current, logger)
	}

	return nil
}

// markerBefore is the marker time for a tick, one ms before its samples so they never share a timestamp.
func markerBefore(tick time.Time) time.Time {
	return tick.Add(-time.Millisecond)
}

// staleOnStop ends the remembered series of a rule that is gone for good.
// The marker goes 1 ms after the latest started tick: Prometheus rejects older markers,
// and a rule created later never has a tick that early.
func (r *recordingRule) staleOnStop(ctx context.Context) {
	reason := ctx.Err()
	if !errors.Is(reason, errRuleDeleted) && !errors.Is(reason, errRuleRestarted) {
		return
	}
	if len(r.written) == 0 || r.lastTick.IsZero() {
		return
	}

	// The rule's own context is cancelled by now.
	writeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), staleOnStopTimeout)
	defer cancel()
	r.markStale(writeCtx, r.lastTick.Add(time.Millisecond), r.logger)
}

// markStale stales every remembered series and forgets all of them.
func (r *recordingRule) markStale(ctx context.Context, markerAt time.Time, logger log.Logger) {
	r.writeStale(ctx, markerAt, nil, logger)
	r.commitWritten(nil, logger)
}

// commitWritten makes next the remembered series. Room goes back for the series that left
// before new ones ask for it, so a series that replaces another fits in a full budget.
// A new series that finds the budget full is not remembered, so it gets no marker later.
func (r *recordingRule) commitWritten(next writtenSeries, logger log.Logger) {
	var leaving writtenSeries
	for target, set := range r.written {
		for fp, labels := range set {
			if !next.contains(target, fp) {
				leaving = leaving.merge(writtenSeries{target: {fp: labels}})
			}
		}
	}
	r.untrack(leaving)

	untracked, admitted := 0, 0
	for target, set := range next {
		for fp := range set {
			if r.written.contains(target, fp) {
				continue
			}
			if r.budget.Admit() {
				r.held++
				admitted++
				continue
			}
			delete(set, fp)
			untracked++
		}
		if len(set) == 0 {
			delete(next, target)
		}
	}
	if untracked > 0 {
		// A map keeps its capacity when entries are deleted, and next was sized for every series.
		next = next.compacted()
		r.metrics.RecordingRuleUntrackedSeries.Add(float64(untracked))
		logger.Warn("Series limit for stale markers reached, new series get no marker", "untracked", untracked, "tracked", r.held)
	}
	r.written = next
	r.metrics.RecordingRuleTrackedSeries.Add(float64(admitted))
}

// untrack forgets the series in gone, which must be in written, and returns their room.
func (r *recordingRule) untrack(gone writtenSeries) {
	n := gone.size()
	if n == 0 {
		return
	}
	r.written.remove(gone)
	r.held -= n
	r.budget.Release(n)
	r.metrics.RecordingRuleTrackedSeries.Sub(float64(n))
}

// writeStale writes markers at markerAt for the series from the previous evaluation that are
// not in current, and forgets them. A failed write is logged, counted and not retried: queries
// hide the series after the lookback anyway. The series are forgotten also when the data write
// that follows fails, so they are not staled again on the next tick.
// The writer sends batches, so part of a failed write may have been accepted. All the series
// of a failed write are counted as failed.
func (r *recordingRule) writeStale(ctx context.Context, markerAt time.Time, current writtenSeries, logger log.Logger) {
	missing := r.written.missingFrom(current)
	for target := range missing {
		err := r.writer.WriteStale(ctx, target.dsUID, target.name, markerAt, target.orgID, missing.labelSets(target))
		if err == nil {
			continue
		}

		reason := markerFailureReason(err)
		r.metrics.StaleMarkerFailures.WithLabelValues(reason).Add(float64(len(missing[target])))
		logger.Warn("Failed to write stale markers", "metric", target.name, "series", len(missing[target]), "reason", reason, "error", err)
	}
	r.untrack(missing)
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
		return nil, fmt.Errorf("response with refID %s has no data: %w", refID, errNoData)
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
