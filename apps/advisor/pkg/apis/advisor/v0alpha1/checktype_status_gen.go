// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CheckTypestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State CheckTypeStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewCheckTypestatusOperatorState creates a new CheckTypestatusOperatorState object.
func NewCheckTypestatusOperatorState() *CheckTypestatusOperatorState {
	return &CheckTypestatusOperatorState{}
}

// +k8s:openapi-gen=true
type CheckTypeStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]CheckTypestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewCheckTypeStatus creates a new CheckTypeStatus object.
func NewCheckTypeStatus() *CheckTypeStatus {
	return &CheckTypeStatus{}
}

// +k8s:openapi-gen=true
type CheckTypeStatusOperatorStateState string

const (
	CheckTypeStatusOperatorStateStateSuccess    CheckTypeStatusOperatorStateState = "success"
	CheckTypeStatusOperatorStateStateInProgress CheckTypeStatusOperatorStateState = "in_progress"
	CheckTypeStatusOperatorStateStateFailed     CheckTypeStatusOperatorStateState = "failed"
)
