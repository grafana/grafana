package dsl

import "github.com/grafana/grafana/pkg/services/accesscontrol"

var _ accesscontrol.Eval = new(any)

func Any(anyOf ...accesscontrol.Eval) accesscontrol.Eval {
	return any{anyOf: anyOf}
}

type any struct {
	anyOf []accesscontrol.Eval
}

func (a any) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	for _, e := range a.anyOf {
		ok, err := e.Evaluate(permissions)
		if err != nil {
			return false, err
		}
		if ok {
			return true, nil
		}
	}
	return false, nil
}

func (a any) Inject(params map[string]string) error {
	for _, e := range a.anyOf {
		if err := e.Inject(params); err != nil {
			return err
		}
	}
	return nil
}
