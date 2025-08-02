// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ShortURLstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ShortURLStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewShortURLstatusOperatorState creates a new ShortURLstatusOperatorState object.
func NewShortURLstatusOperatorState() *ShortURLstatusOperatorState {
	return &ShortURLstatusOperatorState{}
}

// +k8s:openapi-gen=true
type ShortURLStatus struct {
	// The last time the short URL was used, 0 is the initial value
	LastSeenAt int64 `json:"lastSeenAt"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ShortURLstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewShortURLStatus creates a new ShortURLStatus object.
func NewShortURLStatus() *ShortURLStatus {
	return &ShortURLStatus{}
}

// +k8s:openapi-gen=true
type ShortURLStatusOperatorStateState string

const (
	ShortURLStatusOperatorStateStateSuccess    ShortURLStatusOperatorStateState = "success"
	ShortURLStatusOperatorStateStateInProgress ShortURLStatusOperatorStateState = "in_progress"
	ShortURLStatusOperatorStateStateFailed     ShortURLStatusOperatorStateState = "failed"
)
