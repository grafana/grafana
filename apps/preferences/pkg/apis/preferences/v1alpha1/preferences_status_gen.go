// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type PreferencesstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PreferencesStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPreferencesstatusOperatorState creates a new PreferencesstatusOperatorState object.
func NewPreferencesstatusOperatorState() *PreferencesstatusOperatorState {
	return &PreferencesstatusOperatorState{}
}

// +k8s:openapi-gen=true
type PreferencesStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PreferencesstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPreferencesStatus creates a new PreferencesStatus object.
func NewPreferencesStatus() *PreferencesStatus {
	return &PreferencesStatus{}
}

// +k8s:openapi-gen=true
type PreferencesStatusOperatorStateState string

const (
	PreferencesStatusOperatorStateStateSuccess    PreferencesStatusOperatorStateState = "success"
	PreferencesStatusOperatorStateStateInProgress PreferencesStatusOperatorStateState = "in_progress"
	PreferencesStatusOperatorStateStateFailed     PreferencesStatusOperatorStateState = "failed"
)
