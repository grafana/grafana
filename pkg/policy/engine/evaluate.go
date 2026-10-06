package engine

import (
	"context"
	"errors"
	"fmt"
	"math"
	"slices"

	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/interpreter"
	celconfig "k8s.io/apiserver/pkg/apis/cel"
	"k8s.io/apiserver/pkg/cel/lazy"
	"k8s.io/apiserver/pkg/cel/openapi"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/policy/api"
)

// RuntimeCostBudget is the total CEL cost one policy may spend evaluating one input, across
// its variables, match conditions and validations. Each expression is additionally limited
// to celconfig.PerCallLimit by the environment.
const RuntimeCostBudget = celconfig.RuntimeCELCostBudget

var errBudgetExceeded = errors.New("policy evaluation exceeded its cost budget")

const skipReasonNoRequest = "requires request context (oldObject or request), which this input does not have"

// Evaluate runs the policy against one input. It never stops at the first violation: every
// validation is evaluated so callers can report all problems at once.
//
// A policy with a ParamKind is not applicable when in.Params is nil, mirroring a binding whose
// parameter object does not exist.
func (c *CompiledPolicy) Evaluate(ctx context.Context, in Input) Result {
	res := Result{Policy: c.policy.Name}
	v, ok := c.variants[in.GVK]
	if !ok {
		return res
	}
	if in.Request != nil && !slices.Contains(v.operations, in.Request.Operation) {
		return res
	}
	if c.policy.ParamKind != nil && in.Params == nil {
		return res
	}

	ev := &evaluation{ctx: ctx, budget: RuntimeCostBudget}
	ev.activation = newActivation(v, in, ev)
	failurePolicy := c.policy.EffectiveFailurePolicy()

	for _, mc := range v.matchConditions {
		if mc.needsRequest && in.Request == nil {
			res.Skipped = append(res.Skipped, Skip{Policy: res.Policy, Path: mc.path, Reason: skipReasonNoRequest})
			return res
		}
		matched, err := ev.evalBool(mc)
		if err != nil {
			// With Fail an unevaluable condition must not let a resource escape the policy.
			evalErr := EvalError{Policy: res.Policy, Path: mc.path, Err: err}
			if failurePolicy == api.FailurePolicyFail {
				res.Applicable = true
				res.Errors = append(res.Errors, evalErr)
			} else {
				res.Ignored = append(res.Ignored, evalErr)
			}
			return res
		}
		if !matched {
			return res
		}
	}

	res.Applicable = true
	for _, val := range v.validations {
		if val.needsRequest && in.Request == nil {
			res.Skipped = append(res.Skipped, Skip{Policy: res.Policy, Path: val.path, Reason: skipReasonNoRequest})
			continue
		}
		ok, err := ev.evalBool(val.compiledExpr)
		if err != nil {
			evalErr := EvalError{Policy: res.Policy, Path: val.path, Err: err}
			if failurePolicy == api.FailurePolicyFail {
				res.Errors = append(res.Errors, evalErr)
			} else {
				res.Ignored = append(res.Ignored, evalErr)
			}
			if errors.Is(err, errBudgetExceeded) || ctx.Err() != nil {
				return res
			}
			continue
		}
		if !ok {
			res.Violations = append(res.Violations, Violation{
				Policy:     res.Policy,
				Validation: val.name,
				Message:    ev.message(val),
				Reason:     val.source.EffectiveReason(),
				FieldPath:  val.source.FieldPath,
			})
		}
	}
	return res
}

// evaluation holds the per-input state shared by every expression of a policy.
type evaluation struct {
	ctx        context.Context
	budget     int64
	activation interpreter.Activation
}

func (e *evaluation) eval(ce compiledExpr) (ref.Val, error) {
	if e.budget <= 0 {
		return nil, errBudgetExceeded
	}
	if err := e.ctx.Err(); err != nil {
		return nil, err
	}
	out, details, err := ce.program.ContextEval(e.ctx, e.activation)
	if details != nil && details.ActualCost() != nil {
		e.budget -= int64(min(*details.ActualCost(), math.MaxInt64))
	}
	if err != nil {
		return nil, err
	}
	if e.budget < 0 {
		return nil, errBudgetExceeded
	}
	if types.IsError(out) {
		return nil, out.(*types.Err)
	}
	return out, nil
}

func (e *evaluation) evalBool(ce compiledExpr) (bool, error) {
	out, err := e.eval(ce)
	if err != nil {
		return false, err
	}
	b, ok := out.(types.Bool)
	if !ok {
		return false, fmt.Errorf("expected bool, got %s", out.Type().TypeName())
	}
	return bool(b), nil
}

// message picks the violation message: messageExpression when it produces a non-empty string,
// then the static message, then a description of the failed expression.
func (e *evaluation) message(v compiledValidation) string {
	if v.message != nil {
		if out, err := e.eval(*v.message); err == nil {
			if s, ok := out.(types.String); ok && s != "" {
				return string(s)
			}
		}
	}
	if v.source.Message != "" {
		return v.source.Message
	}
	return fmt.Sprintf("failed expression: %s", v.source.Expression)
}

// activation resolves the policy's top-level variables. `variables` is a lazy map, so each
// variable is evaluated at most once per input, and only if something reads it.
type activation struct {
	values map[string]any
}

func newActivation(v *variant, in Input, ev *evaluation) *activation {
	a := &activation{values: map[string]any{
		objectVarName:    toVal(in.Object, v.schema),
		oldObjectVarName: toVal(in.OldObject, v.schema),
		requestVarName:   requestVal(in.Request),
		namespaceVarName: in.Namespace,
	}}
	if v.paramSchema != nil {
		a.values[paramsVarName] = toVal(in.Params, v.paramSchema)
	}
	vars := lazy.NewMapValue(types.NewObjectType(variablesTypeName))
	for _, cv := range v.variables {
		vars.Append(cv.name, func(*lazy.MapValue) ref.Val {
			out, err := ev.eval(cv)
			if err != nil {
				return types.NewErr("variable %q failed to evaluate: %v", cv.name, err)
			}
			return out
		})
	}
	a.values[variablesVarName] = vars
	return a
}

func (a *activation) ResolveName(name string) (any, bool) {
	v, ok := a.values[name]
	return v, ok
}

func (a *activation) Parent() interpreter.Activation { return nil }

func toVal(obj map[string]any, s *spec.Schema) any {
	if obj == nil {
		return types.NullValue
	}
	return openapi.UnstructuredToVal(obj, s)
}

func requestVal(r *RequestInfo) any {
	if r == nil {
		return types.NullValue
	}
	groups := r.UserInfo.Groups
	if groups == nil {
		groups = []string{}
	}
	return map[string]any{
		"operation": string(r.Operation),
		"name":      r.Name,
		"namespace": r.Namespace,
		"userInfo": map[string]any{
			"username": r.UserInfo.Username,
			"uid":      r.UserInfo.UID,
			"groups":   groups,
		},
	}
}
