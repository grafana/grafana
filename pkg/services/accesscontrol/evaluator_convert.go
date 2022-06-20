package accesscontrol

import (
	"encoding/json"
	"fmt"
)

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
