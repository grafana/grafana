// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ResourcePermissionstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ResourcePermissionStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewResourcePermissionstatusOperatorState creates a new ResourcePermissionstatusOperatorState object.
func NewResourcePermissionstatusOperatorState() *ResourcePermissionstatusOperatorState {
	return &ResourcePermissionstatusOperatorState{}
}

// +k8s:openapi-gen=true
type ResourcePermissionStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ResourcePermissionstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewResourcePermissionStatus creates a new ResourcePermissionStatus object.
func NewResourcePermissionStatus() *ResourcePermissionStatus {
	return &ResourcePermissionStatus{}
}

// +k8s:openapi-gen=true
type ResourcePermissionStatusOperatorStateState string

const (
	ResourcePermissionStatusOperatorStateStateSuccess    ResourcePermissionStatusOperatorStateState = "success"
	ResourcePermissionStatusOperatorStateStateInProgress ResourcePermissionStatusOperatorStateState = "in_progress"
	ResourcePermissionStatusOperatorStateStateFailed     ResourcePermissionStatusOperatorStateState = "failed"
)
