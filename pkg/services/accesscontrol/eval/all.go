package eval

var _ Evaluator = new(all)

func All(allOf ...Evaluator) Evaluator {
	return all{allOf: allOf}
}

type all struct {
	allOf []Evaluator
}

func (a all) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	for _, e := range a.allOf {
		if ok, err := e.Evaluate(permissions); !ok || err != nil {
			return false, err
		}
	}
	return true, nil
}

func (a all) Inject(params map[string]string) (Evaluator, error) {
	var injected []Evaluator
	for _, e := range a.allOf {
		i, err := e.Inject(params)
		if err != nil {
			return nil, err
		}
		injected = append(injected, i)
	}
	return All(injected...), nil
}
