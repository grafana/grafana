package v0alpha1

// Defines values for ConfigOperatorStateState.
const (
	ConfigOperatorStateStateFailed     ConfigOperatorStateState = "failed"
	ConfigOperatorStateStateInProgress ConfigOperatorStateState = "in_progress"
	ConfigOperatorStateStateSuccess    ConfigOperatorStateState = "success"
)

// Defines values for ConfigstatusOperatorStateState.
const (
	ConfigstatusOperatorStateStateFailed     ConfigstatusOperatorStateState = "failed"
	ConfigstatusOperatorStateStateInProgress ConfigstatusOperatorStateState = "in_progress"
	ConfigstatusOperatorStateStateSuccess    ConfigstatusOperatorStateState = "success"
)

// ConfigOperatorState defines model for ConfigOperatorState.
// +k8s:openapi-gen=true
type ConfigOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ConfigOperatorStateState `json:"state"`
}

// ConfigOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type ConfigOperatorStateState string

// ConfigStatus defines model for ConfigStatus.
// +k8s:openapi-gen=true
type ConfigStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ConfigstatusOperatorState `json:"operatorStates,omitempty"`
}

// ConfigstatusOperatorState defines model for Configstatus.#OperatorState.
// +k8s:openapi-gen=true
type ConfigstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ConfigstatusOperatorStateState `json:"state"`
}

// ConfigstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type ConfigstatusOperatorStateState string
