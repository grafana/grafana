// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type InvestigationstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State InvestigationStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewInvestigationstatusOperatorState creates a new InvestigationstatusOperatorState object.
func NewInvestigationstatusOperatorState() *InvestigationstatusOperatorState {
	return &InvestigationstatusOperatorState{}
}

// +k8s:openapi-gen=true
type InvestigationStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]InvestigationstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewInvestigationStatus creates a new InvestigationStatus object.
func NewInvestigationStatus() *InvestigationStatus {
	return &InvestigationStatus{}
}

// +k8s:openapi-gen=true
type InvestigationStatusOperatorStateState string

const (
	InvestigationStatusOperatorStateStateSuccess    InvestigationStatusOperatorStateState = "success"
	InvestigationStatusOperatorStateStateInProgress InvestigationStatusOperatorStateState = "in_progress"
	InvestigationStatusOperatorStateStateFailed     InvestigationStatusOperatorStateState = "failed"
)
