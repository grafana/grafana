// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ValidationPolicystatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ValidationPolicyStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewValidationPolicystatusOperatorState creates a new ValidationPolicystatusOperatorState object.
func NewValidationPolicystatusOperatorState() *ValidationPolicystatusOperatorState {
	return &ValidationPolicystatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicystatusOperatorState.
func (ValidationPolicystatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicystatusOperatorState"
}

// +k8s:openapi-gen=true
type ValidationPolicyStatus struct {
	// Errors from the most recent attempt to compile the policy.
	CompileErrors []string `json:"compileErrors,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ValidationPolicystatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewValidationPolicyStatus creates a new ValidationPolicyStatus object.
func NewValidationPolicyStatus() *ValidationPolicyStatus {
	return &ValidationPolicyStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyStatus.
func (ValidationPolicyStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyStatus"
}

// +k8s:openapi-gen=true
type ValidationPolicyStatusOperatorStateState string

const (
	ValidationPolicyStatusOperatorStateStateSuccess    ValidationPolicyStatusOperatorStateState = "success"
	ValidationPolicyStatusOperatorStateStateInProgress ValidationPolicyStatusOperatorStateState = "in_progress"
	ValidationPolicyStatusOperatorStateStateFailed     ValidationPolicyStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyStatusOperatorStateState.
func (ValidationPolicyStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyStatusOperatorStateState"
}
