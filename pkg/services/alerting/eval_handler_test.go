package alerting

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type conditionStub struct {
	firing   bool
	operator string
	matches  []*EvalMatch
	noData   bool
}

func (c *conditionStub) Eval(context *EvalContext, reqHandler legacydata.RequestHandler) (*ConditionResult, error) {
	return &ConditionResult{Firing: c.firing, EvalMatches: c.matches, Operator: c.operator, NoDataFound: c.noData}, nil
}

func TestAlertingEvaluationHandler(t *testing.T) {
	handler := NewEvalHandler(nil)

	t.Run("Show return triggered with single passing condition", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{&conditionStub{
				firing: true,
			}},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, true, context.Firing)
		require.Equal(t, "true = true", context.ConditionEvals)
	})

	t.Run("Show return triggered with single passing condition2", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{&conditionStub{firing: true, operator: "and"}},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, true, context.Firing)
		require.Equal(t, "true = true", context.ConditionEvals)
	})

	t.Run("Show return false with not passing asdf", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: true, operator: "and", matches: []*EvalMatch{{}, {}}},
				&conditionStub{firing: false, operator: "and"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, false, context.Firing)
		require.Equal(t, "[true AND false] = false", context.ConditionEvals)
	})

	t.Run("Show return true if any of the condition is passing with OR operator", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: true, operator: "and"},
				&conditionStub{firing: false, operator: "or"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, true, context.Firing)
		require.Equal(t, "[true OR false] = true", context.ConditionEvals)
	})

	t.Run("Show return false if any of the condition is failing with AND operator", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: true, operator: "and"},
				&conditionStub{firing: false, operator: "and"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, false, context.Firing)
		require.Equal(t, "[true AND false] = false", context.ConditionEvals)
	})

	t.Run("Show return true if one condition is failing with nested OR operator", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: true, operator: "and"},
				&conditionStub{firing: true, operator: "and"},
				&conditionStub{firing: false, operator: "or"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, true, context.Firing)
		require.Equal(t, "[[true AND true] OR false] = true", context.ConditionEvals)
	})

	t.Run("Show return false if one condition is passing with nested OR operator", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: true, operator: "and"},
				&conditionStub{firing: false, operator: "and"},
				&conditionStub{firing: false, operator: "or"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, false, context.Firing)
		require.Equal(t, "[[true AND false] OR false] = false", context.ConditionEvals)
	})

	t.Run("Show return false if a condition is failing with nested AND operator", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: true, operator: "and"},
				&conditionStub{firing: false, operator: "and"},
				&conditionStub{firing: true, operator: "and"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, false, context.Firing)
		require.Equal(t, "[[true AND false] AND true] = false", context.ConditionEvals)
	})

	t.Run("Show return true if a condition is passing with nested OR operator", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: true, operator: "and"},
				&conditionStub{firing: false, operator: "or"},
				&conditionStub{firing: true, operator: "or"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, true, context.Firing)
		require.Equal(t, "[[true OR false] OR true] = true", context.ConditionEvals)
	})

	t.Run("Should return false if no condition is firing using OR operator", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{firing: false, operator: "or"},
				&conditionStub{firing: false, operator: "or"},
				&conditionStub{firing: false, operator: "or"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, false, context.Firing)
		require.Equal(t, "[[false OR false] OR false] = false", context.ConditionEvals)
	})

	// FIXME: What should the actual test case name be here?
	t.Run("Should not return NoDataFound if all conditions have data and using OR", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{operator: "or", noData: false},
				&conditionStub{operator: "or", noData: false},
				&conditionStub{operator: "or", noData: false},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.False(t, context.NoDataFound)
	})

	t.Run("Should return NoDataFound if one condition has no data", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{operator: "and", noData: true},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.Equal(t, false, context.Firing)
		require.True(t, context.NoDataFound)
	})

	t.Run("Should return no data if at least one condition has no data and using AND", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{operator: "and", noData: true},
				&conditionStub{operator: "and", noData: false},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.True(t, context.NoDataFound)
	})

	t.Run("Should return no data if at least one condition has no data and using OR", func(t *testing.T) {
		context := NewEvalContext(context.Background(), &Rule{
			Conditions: []Condition{
				&conditionStub{operator: "or", noData: true},
				&conditionStub{operator: "or", noData: false},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		handler.Eval(context)
		require.True(t, context.NoDataFound)
	})
}
