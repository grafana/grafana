package engine

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/policy/api"
)

// Input is a single resource to evaluate. Admission fills every field; static evaluation
// usually only has Object, so rules that need request context are skipped.
type Input struct {
	GVK schema.GroupVersionKind
	// Object is the resource being validated, in unstructured form. Nil for DELETE.
	Object map[string]any
	// OldObject is the stored resource for UPDATE and DELETE. Nil otherwise.
	OldObject map[string]any
	// Request is nil when the input does not come from a request, such as static evaluation.
	Request *RequestInfo
	// Namespace is the resource's namespace.
	Namespace string
	// Params is the parameter object of the binding being evaluated, in unstructured form.
	// Set fills it per binding; it is only read by policies with a ParamKind.
	Params map[string]any
}

// RequestInfo describes the request that produced an Input.
type RequestInfo struct {
	Operation api.Operation
	Name      string
	Namespace string
	UserInfo  UserInfo
}

type UserInfo struct {
	Username string
	UID      string
	Groups   []string
}

// Result is the outcome of evaluating one policy against one input.
type Result struct {
	Policy string
	// Binding is set when the result is specific to one binding, because the policy was
	// evaluated with that binding's parameters.
	Binding string
	// Applicable is false when the policy does not match the input's kind, version or
	// operation, or when a match condition evaluated to false.
	Applicable bool
	Violations []Violation
	// Errors are evaluation errors kept by FailurePolicy Fail.
	Errors []EvalError
	// Skipped lists rules that could not run because the input lacks request context.
	Skipped []Skip
}

// Violation is a failed validation.
type Violation struct {
	Policy     string
	Validation string
	Message    string
	Reason     api.Reason
	FieldPath  string
}

// EvalError is an expression that failed to evaluate.
type EvalError struct {
	Policy string
	// Path locates the expression in the policy, e.g. "validations[0].expression".
	Path string
	Err  error
}

func (e EvalError) Error() string {
	return e.Policy + ": " + e.Path + ": " + e.Err.Error()
}

func (e EvalError) Unwrap() error { return e.Err }

// Skip is a rule that was not evaluated.
type Skip struct {
	Policy string
	// Path locates the skipped expression in the policy, e.g. "validations[1].expression".
	Path   string
	Reason string
}
