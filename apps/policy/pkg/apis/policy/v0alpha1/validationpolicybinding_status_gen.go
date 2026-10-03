// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ValidationPolicyBindingstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ValidationPolicyBindingStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewValidationPolicyBindingstatusOperatorState creates a new ValidationPolicyBindingstatusOperatorState object.
func NewValidationPolicyBindingstatusOperatorState() *ValidationPolicyBindingstatusOperatorState {
	return &ValidationPolicyBindingstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyBindingstatusOperatorState.
func (ValidationPolicyBindingstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyBindingstatusOperatorState"
}

// +k8s:openapi-gen=true
type ValidationPolicyBindingStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ValidationPolicyBindingstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewValidationPolicyBindingStatus creates a new ValidationPolicyBindingStatus object.
func NewValidationPolicyBindingStatus() *ValidationPolicyBindingStatus {
	return &ValidationPolicyBindingStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyBindingStatus.
func (ValidationPolicyBindingStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyBindingStatus"
}

// +k8s:openapi-gen=true
type ValidationPolicyBindingStatusOperatorStateState string

const (
	ValidationPolicyBindingStatusOperatorStateStateSuccess    ValidationPolicyBindingStatusOperatorStateState = "success"
	ValidationPolicyBindingStatusOperatorStateStateInProgress ValidationPolicyBindingStatusOperatorStateState = "in_progress"
	ValidationPolicyBindingStatusOperatorStateStateFailed     ValidationPolicyBindingStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyBindingStatusOperatorStateState.
func (ValidationPolicyBindingStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyBindingStatusOperatorStateState"
}
