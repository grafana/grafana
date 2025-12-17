package backtesting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule/ticker"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrInvalidInputData = errors.New("invalid input data")

	logger                      = log.New("ngalert.backtesting.engine")
	backtestingEvaluatorFactory = newBacktestingEvaluator
)

type callbackFunc = func(evaluationIndex int, now time.Time, results eval.Results) (bool, error)

type backtestingEvaluator interface {
	Eval(ctx context.Context, from time.Time, interval time.Duration, evaluations int, callback callbackFunc) error
}

type stateManager interface {
	ProcessEvalResults(context.Context, time.Time, *models.AlertRule, eval.Results, data.Labels, state.Sender) state.StateTransitions
	schedule.RuleStateProvider
}

type Engine struct {
	evalFactory          eval.EvaluatorFactory
	createStateManager   func() stateManager
	disableGrafanaFolder bool
	featureToggles       featuremgmt.FeatureToggles
	minInterval          time.Duration
	baseInterval         time.Duration
}

func NewEngine(appUrl *url.URL, evalFactory eval.EvaluatorFactory, tracer tracing.Tracer, cfg *setting.UnifiedAlertingSettings, toggles featuremgmt.FeatureToggles) *Engine {
	return &Engine{
		evalFactory: evalFactory,
		createStateManager: func() stateManager {
			cfg := state.ManagerCfg{
				Metrics:       nil,
				ExternalURL:   appUrl,
				InstanceStore: nil,
				Images:        &NoopImageService{},
				Clock:         clock.New(),
				Historian:     nil,
				Tracer:        tracer,
				Log:           log.New("ngalert.state.manager"),
			}
			return state.NewManager(cfg, state.NewNoopPersister())
		},
		disableGrafanaFolder: false,
		featureToggles:       toggles,
		minInterval:          0,
		baseInterval:         cfg.BaseInterval,
	}
}

func (e *Engine) Test(ctx context.Context, user identity.Requester, rule *models.AlertRule, from, to time.Time) (res *data.Frame, err error) {
	if rule == nil {
		return nil, fmt.Errorf("%w: rule is not defined", ErrInvalidInputData)
	}
	if !from.Before(to) {
		return nil, fmt.Errorf("%w: invalid interval [%d,%d]", ErrInvalidInputData, from.Unix(), to.Unix())
	}

	rule = rule.Copy()
	rule.UID = "backtesting"
	rule.NamespaceUID = "backtesting"
	rule.RuleGroup = "backtesting"

	ruleCtx := models.WithRuleKey(ctx, rule.GetKey())
	logger := logger.FromContext(ruleCtx).New("backtesting", util.GenerateShortUID())

	var warns []string
	if rule.GetInterval() < e.minInterval {
		logger.Warn("Interval adjusted to minimal interval", "originalInterval", rule.GetInterval(), "adjustedInterval", e.minInterval)
		rule.IntervalSeconds = int64(e.minInterval.Seconds())
		warns = append(warns, fmt.Sprintf("Interval adjusted to minimal interval %ds", rule.IntervalSeconds))
	}
	if rule.IntervalSeconds%int64(e.baseInterval.Seconds()) != 0 {
		return nil, fmt.Errorf("%w: interval %ds is not divisible by base interval %ds", ErrInvalidInputData, rule.IntervalSeconds, int64(e.baseInterval.Seconds()))
	}

	// Now calculate the time of the tick the same way as in the scheduler
	firstTick := ticker.GetStartTick(from, e.baseInterval)
	if firstTick != from {
		if firstTick.Before(from) {
			firstTick = firstTick.Add(rule.GetInterval())
		}
		logger.Info("Adjusted the first tick of the backtesting interval", "from", from, "actualFrom", firstTick)
	}
	var evaluations int
	if to.After(firstTick) {
		evaluations = int(to.Sub(firstTick).Seconds()) / int(rule.IntervalSeconds)
	} else {
		evaluations = 1
	}

	start := time.Now()
	defer func() {
		if err != nil {
			logger.Info("Rule testing finished successfully", "duration", time.Since(start))
		}
	}()

	stateMgr := e.createStateManager()

	evaluator, err := backtestingEvaluatorFactory(ruleCtx,
		e.evalFactory,
		user,
		rule.GetEvalCondition().WithSource("backtesting"),
		&schedule.AlertingResultsFromRuleState{
			Manager: stateMgr,
			Rule:    rule,
		},
	)
	if err != nil {
		return nil, errors.Join(ErrInvalidInputData, err)
	}

	logger.Info("Start testing alert rule", "from", from, "to", to, "interval", rule.IntervalSeconds, "evaluations", evaluations)

	var builder *historian.QueryResultBuilder

	ruleMeta := history_model.RuleMeta{
		ID:           rule.ID,
		OrgID:        rule.OrgID,
		UID:          rule.UID,
		Title:        rule.Title,
		Group:        rule.RuleGroup,
		NamespaceUID: rule.NamespaceUID,
		// DashboardUID: "",
		// PanelID:      0,
		Condition: rule.Condition,
	}
	lables := map[string]string{
		historian.OrgIDLabel:     fmt.Sprint(ruleMeta.OrgID),
		historian.GroupLabel:     fmt.Sprint(ruleMeta.Group),
		historian.FolderUIDLabel: fmt.Sprint(rule.NamespaceUID),
	}
	labelsBytes, err := json.Marshal(lables)
	if err != nil {
		return nil, err
	}

	extraLabels := state.GetRuleExtraLabels(logger, rule, "Backtesting", !e.disableGrafanaFolder, e.featureToggles)

	processFn := func(idx int, currentTime time.Time, results eval.Results) (bool, error) {
		if idx >= evaluations {
			logger.Info("Unexpected evaluation. Skipping", "from", from, "to", to, "interval", rule.IntervalSeconds, "evaluationTime", currentTime, "evaluationIndex", idx, "expectedEvaluations", evaluations)
			return false, nil
		}
		if builder == nil {
			builder = historian.NewQueryResultBuilder(evaluations * len(results))
		}
		states := stateMgr.ProcessEvalResults(ruleCtx, currentTime, rule, results, extraLabels, nil)
		for _, s := range states {
			if !historian.ShouldRecord(s) {
				continue
			}
			entry := historian.StateTransitionToLokiEntry(ruleMeta, s)
			err := builder.AddRow(currentTime, entry, labelsBytes)
			if err != nil {
				return false, err
			}
		}
		if currentTime.Add(time.Duration(rule.IntervalSeconds) * time.Second).After(to) {
		}
		return false, nil
	}

	err = evaluator.Eval(ruleCtx, from, rule.GetInterval(), evaluations, processFn)
	if err != nil {
		return nil, err
	}
	if builder == nil {
		return nil, errors.New("no results were produced")
	}
	logger.Info("Rule testing finished successfully", "duration", time.Since(start))
	for _, warn := range warns {
		builder.AddWarn(warn)
	}
	return builder.ToFrame(), nil
}

func newBacktestingEvaluator(ctx context.Context, evalFactory eval.EvaluatorFactory, user identity.Requester, condition models.Condition, reader eval.AlertingResultsReader) (backtestingEvaluator, error) {
	for _, q := range condition.Data {
		if q.DatasourceUID == "__data__" || q.QueryType == "__data__" {
			if len(condition.Data) != 1 {
				return nil, errors.New("data queries are not supported with other expressions or data queries")
			}
			if condition.Condition == "" {
				return nil, fmt.Errorf("condition must not be empty and be set to the data query %s", q.RefID)
			}
			if condition.Condition != q.RefID {
				return nil, fmt.Errorf("condition must be set to the data query %s", q.RefID)
			}
			model := struct {
				DataFrame *data.Frame `json:"data"`
			}{}
			err := json.Unmarshal(q.Model, &model)
			if err != nil {
				return nil, fmt.Errorf("failed to parse data frame: %w", err)
			}
			if model.DataFrame == nil {
				return nil, errors.New("the data field must not be empty")
			}
			return newDataEvaluator(condition.Condition, model.DataFrame)
		}
	}

	evaluator, err := evalFactory.Create(eval.NewContextWithPreviousResults(ctx, user, reader), condition)

	if err != nil {
		return nil, err
	}

	return &queryEvaluator{
		eval: evaluator,
	}, nil
}

// NoopImageService is a no-op image service.
type NoopImageService struct{}

func (s *NoopImageService) NewImage(_ context.Context, _ *models.AlertRule) (*models.Image, error) {
	return &models.Image{}, nil
}

func getNextEvaluationTime(currentTime time.Time, rule *models.AlertRule, baseInterval time.Duration, jitterOffset time.Duration) (time.Time, error) {
	if rule.IntervalSeconds%int64(baseInterval.Seconds()) != 0 {
		return time.Time{}, fmt.Errorf("interval %ds is not divisible by base interval %ds", rule.IntervalSeconds, int64(baseInterval.Seconds()))
	}

	freq := rule.IntervalSeconds / int64(baseInterval.Seconds())

	firstTickNum := currentTime.Unix() / int64(baseInterval.Seconds())

	jitterOffsetTicks := int64(jitterOffset / baseInterval)

	firstEvalTickNum := firstTickNum + (jitterOffsetTicks-(firstTickNum%freq)+freq)%freq

	return time.Unix(firstEvalTickNum*int64(baseInterval.Seconds()), 0), nil
}

func getFirstEvaluationTime(from time.Time, rule *models.AlertRule, baseInterval time.Duration, jitterOffset time.Duration) (time.Time, error) {
	// Now calculate the time of the tick the same way as in the scheduler
	firstTick := ticker.GetStartTick(from, baseInterval)

	// calculate time of the first evaluation that is at or after the first tick
	firstEval, err := getNextEvaluationTime(firstTick, rule, baseInterval, jitterOffset)
	if err != nil {
		return time.Time{}, err
	}

	// Ensure firstEval is at or after from
	// Calculate how many intervals to skip to get past 'from'
	if firstEval.Before(from) {
		diff := from.Sub(firstEval)
		interval := rule.GetInterval()
		// Ceiling division: how many intervals needed to cover the difference
		intervalsToAdd := (diff + interval - 1) / interval
		firstEval = firstEval.Add(interval * intervalsToAdd)
	}

	return firstEval, nil
}

func calculateNumberOfEvaluations(firstEval, to time.Time, interval time.Duration) int {
	var evaluations int
	if to.After(firstEval) {
		evaluations = int(to.Sub(firstEval).Seconds()) / int(interval.Seconds())
	}
	if evaluations == 0 {
		evaluations = 1
	}
	return evaluations
}
