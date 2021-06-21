package dsl

import "github.com/grafana/grafana/pkg/services/accesscontrol"

var _ accesscontrol.Eval = new(all)

func All(allOf ...accesscontrol.Eval) accesscontrol.Eval {
	return all{allOf: allOf}
}

type all struct {
	allOf []accesscontrol.Eval
}

func (a all) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	for _, e := range a.allOf {
		if ok, err := e.Evaluate(permissions); !ok || err != nil {
			return false, err
		}
	}
	return true, nil
}

func (a all) Inject(params map[string]string) error {
	for _, e := range a.allOf {
		if err := e.Inject(params); err != nil {
			return err
		}
	}
	return nil
}
