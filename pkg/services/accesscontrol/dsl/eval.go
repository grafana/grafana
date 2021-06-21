package dsl

type Eval interface {
	// Evaluate permission that are grouped by action
	Evaluate(permissions map[string]map[string]struct{}) (bool, error)
	// Inject params into templated scopes. Eg. "settings:" + dsl.Parameters(":id")
	Inject(params map[string]string) error
}
