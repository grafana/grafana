// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PlayliststatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PlaylistStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPlayliststatusOperatorState creates a new PlayliststatusOperatorState object.
func NewPlayliststatusOperatorState() *PlayliststatusOperatorState {
	return &PlayliststatusOperatorState{}
}

// +k8s:openapi-gen=true
type PlaylistStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PlayliststatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPlaylistStatus creates a new PlaylistStatus object.
func NewPlaylistStatus() *PlaylistStatus {
	return &PlaylistStatus{}
}

// +k8s:openapi-gen=true
type PlaylistStatusOperatorStateState string

const (
	PlaylistStatusOperatorStateStateSuccess    PlaylistStatusOperatorStateState = "success"
	PlaylistStatusOperatorStateStateInProgress PlaylistStatusOperatorStateState = "in_progress"
	PlaylistStatusOperatorStateStateFailed     PlaylistStatusOperatorStateState = "failed"
)
