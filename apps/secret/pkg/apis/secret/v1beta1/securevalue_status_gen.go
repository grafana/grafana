// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type SecureValuestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State SecureValueStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewSecureValuestatusOperatorState creates a new SecureValuestatusOperatorState object.
func NewSecureValuestatusOperatorState() *SecureValuestatusOperatorState {
	return &SecureValuestatusOperatorState{}
}

// +k8s:openapi-gen=true
type SecureValueStatus struct {
	Version int64 `json:"version"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]SecureValuestatusOperatorState `json:"operatorStates,omitempty"`
	// +optional
	ExternalID string `json:"externalID"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewSecureValueStatus creates a new SecureValueStatus object.
func NewSecureValueStatus() *SecureValueStatus {
	return &SecureValueStatus{}
}

// +k8s:openapi-gen=true
type SecureValueStatusOperatorStateState string

const (
	SecureValueStatusOperatorStateStateSuccess    SecureValueStatusOperatorStateState = "success"
	SecureValueStatusOperatorStateStateInProgress SecureValueStatusOperatorStateState = "in_progress"
	SecureValueStatusOperatorStateStateFailed     SecureValueStatusOperatorStateState = "failed"
)
