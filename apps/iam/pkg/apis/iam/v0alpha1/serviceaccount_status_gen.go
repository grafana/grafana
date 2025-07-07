// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ServiceAccountstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ServiceAccountStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewServiceAccountstatusOperatorState creates a new ServiceAccountstatusOperatorState object.
func NewServiceAccountstatusOperatorState() *ServiceAccountstatusOperatorState {
	return &ServiceAccountstatusOperatorState{}
}

// +k8s:openapi-gen=true
type ServiceAccountStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ServiceAccountstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewServiceAccountStatus creates a new ServiceAccountStatus object.
func NewServiceAccountStatus() *ServiceAccountStatus {
	return &ServiceAccountStatus{}
}

// +k8s:openapi-gen=true
type ServiceAccountStatusOperatorStateState string

const (
	ServiceAccountStatusOperatorStateStateSuccess    ServiceAccountStatusOperatorStateState = "success"
	ServiceAccountStatusOperatorStateStateInProgress ServiceAccountStatusOperatorStateState = "in_progress"
	ServiceAccountStatusOperatorStateStateFailed     ServiceAccountStatusOperatorStateState = "failed"
)
