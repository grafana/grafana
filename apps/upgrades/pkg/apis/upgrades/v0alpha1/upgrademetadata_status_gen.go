// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UpgradeMetadatastatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State UpgradeMetadataStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewUpgradeMetadatastatusOperatorState creates a new UpgradeMetadatastatusOperatorState object.
func NewUpgradeMetadatastatusOperatorState() *UpgradeMetadatastatusOperatorState {
	return &UpgradeMetadatastatusOperatorState{}
}

// +k8s:openapi-gen=true
type UpgradeMetadataStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]UpgradeMetadatastatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewUpgradeMetadataStatus creates a new UpgradeMetadataStatus object.
func NewUpgradeMetadataStatus() *UpgradeMetadataStatus {
	return &UpgradeMetadataStatus{}
}

// +k8s:openapi-gen=true
type UpgradeMetadataStatusOperatorStateState string

const (
	UpgradeMetadataStatusOperatorStateStateSuccess    UpgradeMetadataStatusOperatorStateState = "success"
	UpgradeMetadataStatusOperatorStateStateInProgress UpgradeMetadataStatusOperatorStateState = "in_progress"
	UpgradeMetadataStatusOperatorStateStateFailed     UpgradeMetadataStatusOperatorStateState = "failed"
)
