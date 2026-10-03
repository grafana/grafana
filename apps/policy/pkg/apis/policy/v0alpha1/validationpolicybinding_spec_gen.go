// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Deny rejects the request. Warn admits it and returns a warning to the caller.
// +k8s:openapi-gen=true
type ValidationPolicyBindingAction string

const (
	ValidationPolicyBindingActionDeny ValidationPolicyBindingAction = "Deny"
	ValidationPolicyBindingActionWarn ValidationPolicyBindingAction = "Warn"
)

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyBindingAction.
func (ValidationPolicyBindingAction) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyBindingAction"
}

// +k8s:openapi-gen=true
type ValidationPolicyBindingParamRef struct {
	Name string `json:"name"`
}

// NewValidationPolicyBindingParamRef creates a new ValidationPolicyBindingParamRef object.
func NewValidationPolicyBindingParamRef() *ValidationPolicyBindingParamRef {
	return &ValidationPolicyBindingParamRef{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyBindingParamRef.
func (ValidationPolicyBindingParamRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyBindingParamRef"
}

// +k8s:openapi-gen=true
type ValidationPolicyBindingSpec struct {
	PolicyName string                          `json:"policyName"`
	Actions    []ValidationPolicyBindingAction `json:"actions"`
	// Selects the parameter object, in the same namespace. Required when the policy declares
	// a paramKind. When the object does not exist, the binding does not apply.
	ParamRef *ValidationPolicyBindingParamRef `json:"paramRef,omitempty"`
}

// NewValidationPolicyBindingSpec creates a new ValidationPolicyBindingSpec object.
func NewValidationPolicyBindingSpec() *ValidationPolicyBindingSpec {
	return &ValidationPolicyBindingSpec{
		Actions: []ValidationPolicyBindingAction{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyBindingSpec.
func (ValidationPolicyBindingSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyBindingSpec"
}
