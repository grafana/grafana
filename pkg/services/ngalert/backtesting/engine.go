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
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

var (
	ErrInvalidInputData = errors.New("invalid input data")

	logger                      = log.New("ngalert.backtesting.engine")
	backtestingEvaluatorFactory = newBacktestingEvaluator
)

type callbackFunc = func(evaluationIndex int, now time.Time, results eval.Results) error

type backtestingEvaluator interface {
	Eval(ctx context.Context, from time.Time, interval time.Duration, evaluations int, callback callbackFunc) error
}

type stateManager interface {
	ProcessEvalResults(context.Context, time.Time, *models.AlertRule, eval.Results, data.Labels, state.Sender) state.StateTransitions
	schedule.RuleStateProvider
}

type Engine struct {
	evalFactory        eval.EvaluatorFactory
	createStateManager func() stateManager
}

func NewEngine(appUrl *url.URL, evalFactory eval.EvaluatorFactory, tracer tracing.Tracer) *Engine {
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
	}
}

func (e *Engine) Test(ctx context.Context, user identity.Requester, rule *models.AlertRule, from, to time.Time) (*data.Frame, error) {
	ruleCtx := models.WithRuleKey(ctx, rule.GetKey())
	logger := logger.FromContext(ctx)

	if !from.Before(to) {
		return nil, fmt.Errorf("%w: invalid interval of the backtesting [%d,%d]", ErrInvalidInputData, from.Unix(), to.Unix())
	}
	if to.Sub(from).Seconds() < float64(rule.IntervalSeconds) {
		return nil, fmt.Errorf("%w: interval of the backtesting [%d,%d] is less than evaluation interval [%ds]", ErrInvalidInputData, from.Unix(), to.Unix(), rule.IntervalSeconds)
	}
	length := int(to.Sub(from).Seconds()) / int(rule.IntervalSeconds)

	stateManager := e.createStateManager()

	evaluator, err := backtestingEvaluatorFactory(ruleCtx, e.evalFactory, user, rule.GetEvalCondition().WithSource("backtesting"), &schedule.AlertingResultsFromRuleState{
		Manager: stateManager,
		Rule:    rule,
	})
	if err != nil {
		return nil, errors.Join(ErrInvalidInputData, err)
	}

	logger.Info("Start testing alert rule", "from", from, "to", to, "interval", rule.IntervalSeconds, "evaluations", length)

	start := time.Now()

	tsField := data.NewField("Time", nil, make([]time.Time, length))
	valueFields := make(map[data.Fingerprint]*data.Field)

	err = evaluator.Eval(ruleCtx, from, time.Duration(rule.IntervalSeconds)*time.Second, length, func(idx int, currentTime time.Time, results eval.Results) error {
		if idx >= length {
			logger.Info("Unexpected evaluation. Skipping", "from", from, "to", to, "interval", rule.IntervalSeconds, "evaluationTime", currentTime, "evaluationIndex", idx, "expectedEvaluations", length)
			return nil
		}
		states := stateManager.ProcessEvalResults(ruleCtx, currentTime, rule, results, nil, nil)
		tsField.Set(idx, currentTime)
		for _, s := range states {
			field, ok := valueFields[s.CacheID]
			if !ok {
				field = data.NewField("", s.Labels, make([]*string, length))
				valueFields[s.CacheID] = field
			}
			if s.State.State != eval.NoData { // set nil if NoData
				value := s.State.State.String()
				if s.StateReason != "" {
					value += " (" + s.StateReason + ")"
				}
				field.Set(idx, &value)
				continue
			}
		}
		return nil
	})
	fields := make([]*data.Field, 0, len(valueFields)+1)
	fields = append(fields, tsField)
	for _, f := range valueFields {
		fields = append(fields, f)
	}
	result := data.NewFrame("Testing results", fields...)

	if err != nil {
		return nil, err
	}
	logger.Info("Rule testing finished successfully", "duration", time.Since(start))
	return result, nil
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
