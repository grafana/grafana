package accesscontrol

import (
	"context"
	"encoding/json"
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
	var modified []Evaluator
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
	var modified []Evaluator
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

type EvaluatorDTO struct {
	Ev Evaluator
}

// convertFromRaw has a collection of methods for converting raw json unmarshalling to our Evaluator structs.
// This is only used internally to unmarshal json data to an Evaluator
type convertFromRaw struct{}

func fromRaw() *convertFromRaw {
	return &convertFromRaw{}
}

func (f *convertFromRaw) EvaluatorList(raw interface{}) ([]Evaluator, error) {
	var evs []Evaluator

	// First check if it's a list of elements
	itfList, ok := raw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("expected a list of evaluators from '%v'", itfList)
	}
	for _, itf := range itfList {
		// Now check each element could be the json representation of an evaluator
		evRaw, ok := itf.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("expected a key value map from '%v'", evRaw)
		}
		ev, err := f.Evaluator(evRaw)
		if err != nil {
			return nil, err
		}
		if ev == nil {
			continue
		}
		evs = append(evs, ev)
	}
	return evs, nil
}

func (f *convertFromRaw) PermissionEvaluator(raw map[string]interface{}) (Evaluator, error) {
	if _, ok := raw["action"]; !ok {
		return nil, fmt.Errorf("perm evaluator should have an action")
	}
	action, ok := raw["action"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid action found '%v'", raw["action"])
	}
	var scopes []string
	if _, ok := raw["scopes"]; ok {
		scopesItf, ok := raw["scopes"].([]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid scopes found '%v'", raw["scopes"])
		}
		for _, scopeItf := range scopesItf {
			scope, ok := scopeItf.(string)
			if !ok {
				return nil, fmt.Errorf("invalid scope found '%v'", scopeItf)
			}
			scopes = append(scopes, scope)
		}
	}
	return EvalPermission(action, scopes...), nil
}

func (f *convertFromRaw) Evaluator(raw map[string]interface{}) (Evaluator, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	rawHas := func(key string) bool { _, ok := raw[key]; return ok }
	switch {
	case rawHas("action"):
		return f.PermissionEvaluator(raw)
	case rawHas("any"):
		anyOf, errParse := f.EvaluatorList(raw["any"])
		if errParse != nil {
			return nil, errParse
		}
		return EvalAny(anyOf...), nil
	case rawHas("all"):
		allOf, errParse := f.EvaluatorList(raw["all"])
		if errParse != nil {
			return nil, errParse
		}
		return EvalAll(allOf...), nil
	default:
		return nil, fmt.Errorf("expected 'any', 'all' or 'perm' evaluator")
	}
}

func (ev *EvaluatorDTO) UnmarshalJSON(data []byte) error {
	raw := map[string]interface{}{}
	err := json.Unmarshal(data, &raw)
	if err != nil {
		return fmt.Errorf("unmarshalling expected 'any', 'all' or 'perm'")
	}

	parsed, errParse := fromRaw().Evaluator(raw)
	if errParse != nil {
		return fmt.Errorf("error parsing evaluator: %w", errParse)
	}

	ev.Ev = parsed
	return nil
}
