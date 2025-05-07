// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ManagedPermissionstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ManagedPermissionStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewManagedPermissionstatusOperatorState creates a new ManagedPermissionstatusOperatorState object.
func NewManagedPermissionstatusOperatorState() *ManagedPermissionstatusOperatorState {
	return &ManagedPermissionstatusOperatorState{}
}

// +k8s:openapi-gen=true
type ManagedPermissionStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ManagedPermissionstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewManagedPermissionStatus creates a new ManagedPermissionStatus object.
func NewManagedPermissionStatus() *ManagedPermissionStatus {
	return &ManagedPermissionStatus{}
}

// +k8s:openapi-gen=true
type ManagedPermissionStatusOperatorStateState string

const (
	ManagedPermissionStatusOperatorStateStateSuccess    ManagedPermissionStatusOperatorStateState = "success"
	ManagedPermissionStatusOperatorStateStateInProgress ManagedPermissionStatusOperatorStateState = "in_progress"
	ManagedPermissionStatusOperatorStateStateFailed     ManagedPermissionStatusOperatorStateState = "failed"
)
