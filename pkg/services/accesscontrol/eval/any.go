package eval

var _ Evaluator = new(any)

func Any(anyOf ...Evaluator) Evaluator {
	return any{anyOf: anyOf}
}

type any struct {
	anyOf []Evaluator
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

func (a any) Inject(params map[string]string) (Evaluator, error) {
	var injected []Evaluator
	for _, e := range a.anyOf {
		i, err := e.Inject(params)
		if err != nil {
			return nil, err
		}
		injected = append(injected, i)
	}
	return Any(injected...), nil
}
