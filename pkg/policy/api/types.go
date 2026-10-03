// Package api defines the policy and binding types evaluated by the policy engine.
//
// The shape follows Kubernetes ValidatingAdmissionPolicy so that policies are familiar to
// authors, but the types carry no dependency on admission so they can be used by any
// execution environment (admission, static evaluation, webhooks).
package api

// Policy is a set of CEL validations that apply to one or more resource kinds.
type Policy struct {
	// Name uniquely identifies the policy. Bindings reference policies by name.
	Name string `json:"name" yaml:"name"`
	// Match selects the resources the policy applies to. A policy is compiled once for every
	// kind and version it matches.
	Match []ResourceMatch `json:"match" yaml:"match"`
	// MatchConditions further filter matched resources. All conditions must evaluate to true
	// for the policy to apply.
	MatchConditions []NamedExpression `json:"matchConditions,omitempty" yaml:"matchConditions,omitempty"`
	// Variables are named expressions available to later variables, match conditions and
	// validations as `variables.<name>`. They are evaluated lazily, at most once per evaluation.
	Variables []NamedExpression `json:"variables,omitempty" yaml:"variables,omitempty"`
	// Validations are the rules a matched resource must satisfy.
	Validations []Validation `json:"validations" yaml:"validations"`
	// FailurePolicy decides how evaluation errors are treated. Defaults to Fail.
	FailurePolicy FailurePolicy `json:"failurePolicy,omitempty" yaml:"failurePolicy,omitempty"`
	// ParamKind declares the kind of the parameter object available to expressions as `params`.
	// Each binding of the policy selects its parameter object with ParamRef, so the same policy
	// can behave differently per binding. Without ParamKind, `params` is undefined.
	ParamKind *ParamKind `json:"paramKind,omitempty" yaml:"paramKind,omitempty"`
}

// ParamKind identifies the kind of a policy's parameter object.
type ParamKind struct {
	Group   string `json:"group" yaml:"group"`
	Version string `json:"version" yaml:"version"`
	Kind    string `json:"kind" yaml:"kind"`
}

// ParamRef selects the parameter object of a binding, in the namespace of the evaluated resource.
type ParamRef struct {
	Name string `json:"name" yaml:"name"`
}

// ResourceMatch selects resources by group, versions and kinds.
type ResourceMatch struct {
	Group    string   `json:"group" yaml:"group"`
	Versions []string `json:"versions" yaml:"versions"`
	Kinds    []string `json:"kinds" yaml:"kinds"`
	// Operations limits the policy to the given request operations. Empty means CREATE and
	// UPDATE. Inputs without request context, such as static evaluation, ignore operations.
	Operations []Operation `json:"operations,omitempty" yaml:"operations,omitempty"`
}

// NamedExpression is a CEL expression with a name.
type NamedExpression struct {
	Name       string `json:"name" yaml:"name"`
	Expression string `json:"expression" yaml:"expression"`
}

// Validation is a single CEL rule. The expression must evaluate to true for the resource to be valid.
type Validation struct {
	// Name optionally identifies the validation in results. Defaults to its index.
	Name       string `json:"name,omitempty" yaml:"name,omitempty"`
	Expression string `json:"expression" yaml:"expression"`
	// Message is returned when the validation fails.
	Message string `json:"message,omitempty" yaml:"message,omitempty"`
	// MessageExpression is a CEL expression returning a string. It takes precedence over
	// Message when it evaluates successfully to a non-empty string.
	MessageExpression string `json:"messageExpression,omitempty" yaml:"messageExpression,omitempty"`
	// Reason is the machine-readable reason returned when the validation fails. Defaults to Invalid.
	Reason Reason `json:"reason,omitempty" yaml:"reason,omitempty"`
	// FieldPath points at the field responsible for the failure, e.g. "spec.trigger.interval".
	FieldPath string `json:"fieldPath,omitempty" yaml:"fieldPath,omitempty"`
}

// Binding connects a policy to the actions taken when it is violated.
type Binding struct {
	Name       string   `json:"name" yaml:"name"`
	PolicyName string   `json:"policyName" yaml:"policyName"`
	Actions    []Action `json:"actions" yaml:"actions"`
	// Namespaces restricts the binding to the given namespaces. Empty means all namespaces.
	Namespaces []string `json:"namespaces,omitempty" yaml:"namespaces,omitempty"`
	// ParamRef selects the parameter object. Required when the policy declares a ParamKind.
	// When the object does not exist, the binding does not apply.
	ParamRef *ParamRef `json:"paramRef,omitempty" yaml:"paramRef,omitempty"`
}

type Operation string

const (
	OperationCreate Operation = "CREATE"
	OperationUpdate Operation = "UPDATE"
	OperationDelete Operation = "DELETE"
)

type FailurePolicy string

const (
	// FailurePolicyFail reports evaluation errors so that bindings treat them as violations.
	FailurePolicyFail FailurePolicy = "Fail"
	// FailurePolicyIgnore drops evaluation errors.
	FailurePolicyIgnore FailurePolicy = "Ignore"
)

type Action string

const (
	// ActionDeny rejects the request.
	ActionDeny Action = "Deny"
	// ActionWarn admits the request and returns a warning to the caller.
	ActionWarn Action = "Warn"
)

type Reason string

const (
	ReasonInvalid      Reason = "Invalid"
	ReasonForbidden    Reason = "Forbidden"
	ReasonUnauthorized Reason = "Unauthorized"
)

// DefaultOperations are the operations a ResourceMatch applies to when none are given.
var DefaultOperations = []Operation{OperationCreate, OperationUpdate}

// EffectiveFailurePolicy returns the policy's failure policy, applying the default.
func (p Policy) EffectiveFailurePolicy() FailurePolicy {
	if p.FailurePolicy == "" {
		return FailurePolicyFail
	}
	return p.FailurePolicy
}

// EffectiveOperations returns the match's operations, applying the default.
func (m ResourceMatch) EffectiveOperations() []Operation {
	if len(m.Operations) == 0 {
		return DefaultOperations
	}
	return m.Operations
}

// EffectiveReason returns the validation's reason, applying the default.
func (v Validation) EffectiveReason() Reason {
	if v.Reason == "" {
		return ReasonInvalid
	}
	return v.Reason
}
