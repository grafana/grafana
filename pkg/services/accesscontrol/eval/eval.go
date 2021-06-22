package eval

type Evaluator interface {
	// Evaluate permissions that are grouped by action
	Evaluate(permissions map[string]map[string]struct{}) (bool, error)
	// Inject params into templated scopes. Eg. "settings:" + eval.Parameters(":id") and returns a new Evaluator
	Inject(params map[string]string) (Evaluator, error)
}
