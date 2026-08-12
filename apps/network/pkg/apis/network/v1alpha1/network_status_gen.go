// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type NetworkstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State NetworkStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewNetworkstatusOperatorState creates a new NetworkstatusOperatorState object.
func NewNetworkstatusOperatorState() *NetworkstatusOperatorState {
	return &NetworkstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for NetworkstatusOperatorState.
func (NetworkstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.network.pkg.apis.network.v1alpha1.NetworkstatusOperatorState"
}

// +k8s:openapi-gen=true
type NetworkStatus struct {
	// Optional. tsnet exposes node key expiry via LocalClient().Status;
	// surfacing it would be genuinely useful in the UI, but it needs a
	// reconciler. Left empty in the prototype.
	// +optional
	LastConnected *string `json:"lastConnected,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]NetworkstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewNetworkStatus creates a new NetworkStatus object.
func NewNetworkStatus() *NetworkStatus {
	return &NetworkStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for NetworkStatus.
func (NetworkStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.network.pkg.apis.network.v1alpha1.NetworkStatus"
}

// +k8s:openapi-gen=true
type NetworkStatusOperatorStateState string

const (
	NetworkStatusOperatorStateStateSuccess    NetworkStatusOperatorStateState = "success"
	NetworkStatusOperatorStateStateInProgress NetworkStatusOperatorStateState = "in_progress"
	NetworkStatusOperatorStateStateFailed     NetworkStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for NetworkStatusOperatorStateState.
func (NetworkStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.network.pkg.apis.network.v1alpha1.NetworkStatusOperatorStateState"
}
