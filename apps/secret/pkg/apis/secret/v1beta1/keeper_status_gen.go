// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type KeeperstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State KeeperStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewKeeperstatusOperatorState creates a new KeeperstatusOperatorState object.
func NewKeeperstatusOperatorState() *KeeperstatusOperatorState {
	return &KeeperstatusOperatorState{}
}

// +k8s:openapi-gen=true
type KeeperStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]KeeperstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewKeeperStatus creates a new KeeperStatus object.
func NewKeeperStatus() *KeeperStatus {
	return &KeeperStatus{}
}

// +k8s:openapi-gen=true
type KeeperStatusOperatorStateState string

const (
	KeeperStatusOperatorStateStateSuccess    KeeperStatusOperatorStateState = "success"
	KeeperStatusOperatorStateStateInProgress KeeperStatusOperatorStateState = "in_progress"
	KeeperStatusOperatorStateStateFailed     KeeperStatusOperatorStateState = "failed"
)
