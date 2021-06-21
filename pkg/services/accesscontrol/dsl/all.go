package dsl

var _ Eval = new(all)

func All(eval ...Eval) Eval {
	return all{allOf: eval}
}

type all struct {
	allOf []Eval
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
