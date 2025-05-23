// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TemplateGroupstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TemplateGroupStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewTemplateGroupstatusOperatorState creates a new TemplateGroupstatusOperatorState object.
func NewTemplateGroupstatusOperatorState() *TemplateGroupstatusOperatorState {
	return &TemplateGroupstatusOperatorState{}
}

// +k8s:openapi-gen=true
type TemplateGroupStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]TemplateGroupstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewTemplateGroupStatus creates a new TemplateGroupStatus object.
func NewTemplateGroupStatus() *TemplateGroupStatus {
	return &TemplateGroupStatus{}
}

// +k8s:openapi-gen=true
type TemplateGroupStatusOperatorStateState string

const (
	TemplateGroupStatusOperatorStateStateSuccess    TemplateGroupStatusOperatorStateState = "success"
	TemplateGroupStatusOperatorStateStateInProgress TemplateGroupStatusOperatorStateState = "in_progress"
	TemplateGroupStatusOperatorStateStateFailed     TemplateGroupStatusOperatorStateState = "failed"
)
