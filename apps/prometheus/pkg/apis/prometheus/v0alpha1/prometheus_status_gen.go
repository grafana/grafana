// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PrometheusStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPrometheusstatusOperatorState creates a new PrometheusstatusOperatorState object.
func NewPrometheusstatusOperatorState() *PrometheusstatusOperatorState {
	return &PrometheusstatusOperatorState{}
}

// +k8s:openapi-gen=true
type PrometheusStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PrometheusstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPrometheusStatus creates a new PrometheusStatus object.
func NewPrometheusStatus() *PrometheusStatus {
	return &PrometheusStatus{}
}

// +k8s:openapi-gen=true
type PrometheusStatusOperatorStateState string

const (
	PrometheusStatusOperatorStateStateSuccess    PrometheusStatusOperatorStateState = "success"
	PrometheusStatusOperatorStateStateInProgress PrometheusStatusOperatorStateState = "in_progress"
	PrometheusStatusOperatorStateStateFailed     PrometheusStatusOperatorStateState = "failed"
)
