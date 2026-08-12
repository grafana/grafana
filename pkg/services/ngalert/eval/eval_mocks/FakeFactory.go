package eval_mocks

import (
	"errors"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type fakeEvaluatorFactory struct {
	err       error
	evaluator eval.ConditionEvaluator
}

func NewEvaluatorFactory(evaluator eval.ConditionEvaluator) eval.EvaluatorFactory {
	return &fakeEvaluatorFactory{evaluator: evaluator}
}

func NewFailingEvaluatorFactory(err error) eval.EvaluatorFactory {
	if err == nil {
		err = errors.New("test")
	}
	return &fakeEvaluatorFactory{err: err}
}

func (f fakeEvaluatorFactory) Validate(ctx eval.EvaluationContext, condition models.Condition) error {
	return f.err
}

func (f fakeEvaluatorFactory) Create(ctx eval.EvaluationContext, condition models.Condition) (eval.ConditionEvaluator, error) {
	return f.evaluator, f.err
}
