// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type InvestigationIndexstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State InvestigationIndexStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewInvestigationIndexstatusOperatorState creates a new InvestigationIndexstatusOperatorState object.
func NewInvestigationIndexstatusOperatorState() *InvestigationIndexstatusOperatorState {
	return &InvestigationIndexstatusOperatorState{}
}

// +k8s:openapi-gen=true
type InvestigationIndexStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]InvestigationIndexstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewInvestigationIndexStatus creates a new InvestigationIndexStatus object.
func NewInvestigationIndexStatus() *InvestigationIndexStatus {
	return &InvestigationIndexStatus{}
}

// +k8s:openapi-gen=true
type InvestigationIndexStatusOperatorStateState string

const (
	InvestigationIndexStatusOperatorStateStateSuccess    InvestigationIndexStatusOperatorStateState = "success"
	InvestigationIndexStatusOperatorStateStateInProgress InvestigationIndexStatusOperatorStateState = "in_progress"
	InvestigationIndexStatusOperatorStateStateFailed     InvestigationIndexStatusOperatorStateState = "failed"
)
