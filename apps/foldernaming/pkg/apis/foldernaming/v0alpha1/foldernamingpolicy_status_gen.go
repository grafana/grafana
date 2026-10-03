// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FolderNamingPolicystatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State FolderNamingPolicyStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewFolderNamingPolicystatusOperatorState creates a new FolderNamingPolicystatusOperatorState object.
func NewFolderNamingPolicystatusOperatorState() *FolderNamingPolicystatusOperatorState {
	return &FolderNamingPolicystatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for FolderNamingPolicystatusOperatorState.
func (FolderNamingPolicystatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.foldernaming.pkg.apis.foldernaming.v0alpha1.FolderNamingPolicystatusOperatorState"
}

// +k8s:openapi-gen=true
type FolderNamingPolicyStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]FolderNamingPolicystatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewFolderNamingPolicyStatus creates a new FolderNamingPolicyStatus object.
func NewFolderNamingPolicyStatus() *FolderNamingPolicyStatus {
	return &FolderNamingPolicyStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for FolderNamingPolicyStatus.
func (FolderNamingPolicyStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.foldernaming.pkg.apis.foldernaming.v0alpha1.FolderNamingPolicyStatus"
}

// +k8s:openapi-gen=true
type FolderNamingPolicyStatusOperatorStateState string

const (
	FolderNamingPolicyStatusOperatorStateStateSuccess    FolderNamingPolicyStatusOperatorStateState = "success"
	FolderNamingPolicyStatusOperatorStateStateInProgress FolderNamingPolicyStatusOperatorStateState = "in_progress"
	FolderNamingPolicyStatusOperatorStateStateFailed     FolderNamingPolicyStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for FolderNamingPolicyStatusOperatorStateState.
func (FolderNamingPolicyStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.foldernaming.pkg.apis.foldernaming.v0alpha1.FolderNamingPolicyStatusOperatorStateState"
}
