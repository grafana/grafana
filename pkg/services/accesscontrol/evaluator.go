package accesscontrol

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("accesscontrol.evaluator")

type Evaluator interface {
	// Evaluate permissions that are grouped by action
	Evaluate(permissions map[string][]string) bool
	// MutateScopes executes a sequence of ScopeModifier functions on all embedded scopes of an evaluator and returns a new Evaluator
	MutateScopes(ctx context.Context, mutate ScopeAttributeMutator) (Evaluator, error)
	// String returns a string representation of permission required by the evaluator
	fmt.Stringer
	fmt.GoStringer
}

var _ Evaluator = new(permissionEvaluator)

// EvalPermission returns an evaluator that will require at least one of passed scopes to match
func EvalPermission(action string, scopes ...string) Evaluator {
	return permissionEvaluator{Action: action, Scopes: scopes}
}

type permissionEvaluator struct {
	Action string
	Scopes []string
}

func (p permissionEvaluator) Evaluate(permissions map[string][]string) bool {
	userScopes, ok := permissions[p.Action]
	if !ok {
		return false
	}

	if len(p.Scopes) == 0 {
		return true
	}

	for _, target := range p.Scopes {
		for _, scope := range userScopes {
			if match(scope, target) {
				return true
			}
		}
	}

	return false
}

func match(scope, target string) bool {
	if scope == "" {
		return false
	}

	if !ValidateScope(scope) {
		logger.Error(
			"invalid scope",
			"scope", scope,
			"reason", "scopes should not contain meta-characters like * or ?, except in the last position",
		)
		return false
	}

	prefix, last := scope[:len(scope)-1], scope[len(scope)-1]
	//Prefix match
	if last == '*' {
		if strings.HasPrefix(target, prefix) {
			logger.Debug("matched scope", "user scope", scope, "target scope", target)
			return true
		}
	}

	return scope == target
}

func (p permissionEvaluator) MutateScopes(ctx context.Context, mutate ScopeAttributeMutator) (Evaluator, error) {
	if p.Scopes == nil {
		return EvalPermission(p.Action), nil
	}

	scopes := make([]string, 0, len(p.Scopes))
	for _, scope := range p.Scopes {
		mutated, err := mutate(ctx, scope)
		if err != nil {
			return nil, err
		}
		scopes = append(scopes, mutated...)
	}
	return EvalPermission(p.Action, scopes...), nil
}

func (p permissionEvaluator) String() string {
	return p.Action
}

func (p permissionEvaluator) GoString() string {
	return fmt.Sprintf("action:%s scopes:%s", p.Action, strings.Join(p.Scopes, ", "))
}

var _ Evaluator = new(allEvaluator)

// EvalAll returns evaluator that requires all passed evaluators to evaluate to true
func EvalAll(allOf ...Evaluator) Evaluator {
	return allEvaluator{allOf: allOf}
}

type allEvaluator struct {
	allOf []Evaluator
}

func (a allEvaluator) Evaluate(permissions map[string][]string) bool {
	for _, e := range a.allOf {
		if !e.Evaluate(permissions) {
			return false
		}
	}
	return true
}

func (a allEvaluator) MutateScopes(ctx context.Context, mutate ScopeAttributeMutator) (Evaluator, error) {
	modified := make([]Evaluator, 0, len(a.allOf))
	for _, e := range a.allOf {
		i, err := e.MutateScopes(ctx, mutate)
		if err != nil {
			return nil, err
		}
		modified = append(modified, i)
	}
	return EvalAll(modified...), nil
}

func (a allEvaluator) String() string {
	permissions := make([]string, 0, len(a.allOf))
	for _, e := range a.allOf {
		permissions = append(permissions, e.String())
	}

	return fmt.Sprintf("all of %s", strings.Join(permissions, ", "))
}

func (a allEvaluator) GoString() string {
	permissions := make([]string, 0, len(a.allOf))
	for _, e := range a.allOf {
		permissions = append(permissions, e.GoString())
	}

	return fmt.Sprintf("all(%s)", strings.Join(permissions, " "))
}

var _ Evaluator = new(anyEvaluator)

// EvalAny returns evaluator that requires at least one of passed evaluators to evaluate to true
func EvalAny(anyOf ...Evaluator) Evaluator {
	return anyEvaluator{anyOf: anyOf}
}

type anyEvaluator struct {
	anyOf []Evaluator
}

func (a anyEvaluator) Evaluate(permissions map[string][]string) bool {
	for _, e := range a.anyOf {
		if e.Evaluate(permissions) {
			return true
		}
	}
	return false
}

func (a anyEvaluator) MutateScopes(ctx context.Context, mutate ScopeAttributeMutator) (Evaluator, error) {
	modified := make([]Evaluator, 0, len(a.anyOf))
	for _, e := range a.anyOf {
		i, err := e.MutateScopes(ctx, mutate)
		if err != nil {
			return nil, err
		}
		modified = append(modified, i)
	}
	return EvalAny(modified...), nil
}

func (a anyEvaluator) String() string {
	permissions := make([]string, 0, len(a.anyOf))
	for _, e := range a.anyOf {
		permissions = append(permissions, e.String())
	}

	return fmt.Sprintf("any of %s", strings.Join(permissions, ", "))
}

func (a anyEvaluator) GoString() string {
	permissions := make([]string, 0, len(a.anyOf))
	for _, e := range a.anyOf {
		permissions = append(permissions, e.String())
	}

	return fmt.Sprintf("any(%s)", strings.Join(permissions, " "))
}
