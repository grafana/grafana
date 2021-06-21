package eval

type Eval interface {
	// Evaluate permission that are grouped by action
	Evaluate(permissions map[string]map[string]struct{}) (bool, error)
	// Inject params into templated scopes. Eg. "settings:" + eval.Parameters(":id")
	Inject(params map[string]string) error
}
