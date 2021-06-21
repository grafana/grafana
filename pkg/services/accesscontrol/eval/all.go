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

func (a all) Inject(params map[string]string) error {
	for _, e := range a.allOf {
		if err := e.Inject(params); err != nil {
			return err
		}
	}
	return nil
}
