package v0alpha1

// Defines values for PlaylistOperatorStateState.
const (
	PlaylistOperatorStateStateFailed     PlaylistOperatorStateState = "failed"
	PlaylistOperatorStateStateInProgress PlaylistOperatorStateState = "in_progress"
	PlaylistOperatorStateStateSuccess    PlaylistOperatorStateState = "success"
)

// Defines values for PlayliststatusOperatorStateState.
const (
	PlayliststatusOperatorStateStateFailed     PlayliststatusOperatorStateState = "failed"
	PlayliststatusOperatorStateStateInProgress PlayliststatusOperatorStateState = "in_progress"
	PlayliststatusOperatorStateStateSuccess    PlayliststatusOperatorStateState = "success"
)

// PlaylistOperatorState defines model for PlaylistOperatorState.
// +k8s:openapi-gen=true
type PlaylistOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PlaylistOperatorStateState `json:"state"`
}

// PlaylistOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type PlaylistOperatorStateState string

// PlaylistStatus defines model for PlaylistStatus.
// +k8s:openapi-gen=true
type PlaylistStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PlayliststatusOperatorState `json:"operatorStates,omitempty"`
}

// PlayliststatusOperatorState defines model for Playliststatus.#OperatorState.
// +k8s:openapi-gen=true
type PlayliststatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PlayliststatusOperatorStateState `json:"state"`
}

// PlayliststatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type PlayliststatusOperatorStateState string
