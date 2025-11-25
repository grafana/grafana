// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type QuotastatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State QuotaStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewQuotastatusOperatorState creates a new QuotastatusOperatorState object.
func NewQuotastatusOperatorState() *QuotastatusOperatorState {
	return &QuotastatusOperatorState{}
}

// +k8s:openapi-gen=true
type QuotaStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]QuotastatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewQuotaStatus creates a new QuotaStatus object.
func NewQuotaStatus() *QuotaStatus {
	return &QuotaStatus{}
}

// +k8s:openapi-gen=true
type QuotaStatusOperatorStateState string

const (
	QuotaStatusOperatorStateStateSuccess    QuotaStatusOperatorStateState = "success"
	QuotaStatusOperatorStateStateInProgress QuotaStatusOperatorStateState = "in_progress"
	QuotaStatusOperatorStateStateFailed     QuotaStatusOperatorStateState = "failed"
)
