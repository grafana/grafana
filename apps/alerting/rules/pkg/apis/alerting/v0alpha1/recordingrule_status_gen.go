// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RecordingRulestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RecordingRuleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRecordingRulestatusOperatorState creates a new RecordingRulestatusOperatorState object.
func NewRecordingRulestatusOperatorState() *RecordingRulestatusOperatorState {
	return &RecordingRulestatusOperatorState{}
}

// +k8s:openapi-gen=true
type RecordingRuleStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RecordingRulestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRecordingRuleStatus creates a new RecordingRuleStatus object.
func NewRecordingRuleStatus() *RecordingRuleStatus {
	return &RecordingRuleStatus{}
}

// +k8s:openapi-gen=true
type RecordingRuleStatusOperatorStateState string

const (
	RecordingRuleStatusOperatorStateStateSuccess    RecordingRuleStatusOperatorStateState = "success"
	RecordingRuleStatusOperatorStateStateInProgress RecordingRuleStatusOperatorStateState = "in_progress"
	RecordingRuleStatusOperatorStateStateFailed     RecordingRuleStatusOperatorStateState = "failed"
)
