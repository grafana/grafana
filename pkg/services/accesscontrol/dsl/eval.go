package dsl

type Eval interface {
	Evaluate(permissions map[string]map[string]struct{}) (bool, error)
	Inject(params map[string]string) error
}
