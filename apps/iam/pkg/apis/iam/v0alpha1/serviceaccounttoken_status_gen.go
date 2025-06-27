// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ServiceAccountTokenstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ServiceAccountTokenStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewServiceAccountTokenstatusOperatorState creates a new ServiceAccountTokenstatusOperatorState object.
func NewServiceAccountTokenstatusOperatorState() *ServiceAccountTokenstatusOperatorState {
	return &ServiceAccountTokenstatusOperatorState{}
}

// +k8s:openapi-gen=true
type ServiceAccountTokenStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ServiceAccountTokenstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewServiceAccountTokenStatus creates a new ServiceAccountTokenStatus object.
func NewServiceAccountTokenStatus() *ServiceAccountTokenStatus {
	return &ServiceAccountTokenStatus{}
}

// +k8s:openapi-gen=true
type ServiceAccountTokenStatusOperatorStateState string

const (
	ServiceAccountTokenStatusOperatorStateStateSuccess    ServiceAccountTokenStatusOperatorStateState = "success"
	ServiceAccountTokenStatusOperatorStateStateInProgress ServiceAccountTokenStatusOperatorStateState = "in_progress"
	ServiceAccountTokenStatusOperatorStateStateFailed     ServiceAccountTokenStatusOperatorStateState = "failed"
)
