// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type MyResourcestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State MyResourceStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewMyResourcestatusOperatorState creates a new MyResourcestatusOperatorState object.
func NewMyResourcestatusOperatorState() *MyResourcestatusOperatorState {
	return &MyResourcestatusOperatorState{}
}

// +k8s:openapi-gen=true
type MyResourceStatus struct {
	// Whether the resource is ready
	Ready bool `json:"ready"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]MyResourcestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewMyResourceStatus creates a new MyResourceStatus object.
func NewMyResourceStatus() *MyResourceStatus {
	return &MyResourceStatus{}
}

// +k8s:openapi-gen=true
type MyResourceStatusOperatorStateState string

const (
	MyResourceStatusOperatorStateStateSuccess    MyResourceStatusOperatorStateState = "success"
	MyResourceStatusOperatorStateStateInProgress MyResourceStatusOperatorStateState = "in_progress"
	MyResourceStatusOperatorStateStateFailed     MyResourceStatusOperatorStateState = "failed"
)

func (MyResourcestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.myresource.pkg.apis.myresource.v1beta1.MyResourcestatusOperatorState"
}

func (MyResourceStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.myresource.pkg.apis.myresource.v1beta1.MyResourceStatus"
}
