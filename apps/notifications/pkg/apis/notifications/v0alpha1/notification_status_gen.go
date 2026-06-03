// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type NotificationstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State NotificationStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewNotificationstatusOperatorState creates a new NotificationstatusOperatorState object.
func NewNotificationstatusOperatorState() *NotificationstatusOperatorState {
	return &NotificationstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for NotificationstatusOperatorState.
func (NotificationstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.notifications.pkg.apis.notifications.v0alpha1.NotificationstatusOperatorState"
}

// +k8s:openapi-gen=true
type NotificationStatus struct {
	Read bool `json:"read"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]NotificationstatusOperatorState `json:"operatorStates,omitempty"`
	// RFC3339
	ReadAt *string `json:"readAt,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewNotificationStatus creates a new NotificationStatus object.
func NewNotificationStatus() *NotificationStatus {
	return &NotificationStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for NotificationStatus.
func (NotificationStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.notifications.pkg.apis.notifications.v0alpha1.NotificationStatus"
}

// +k8s:openapi-gen=true
type NotificationStatusOperatorStateState string

const (
	NotificationStatusOperatorStateStateSuccess    NotificationStatusOperatorStateState = "success"
	NotificationStatusOperatorStateStateInProgress NotificationStatusOperatorStateState = "in_progress"
	NotificationStatusOperatorStateStateFailed     NotificationStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for NotificationStatusOperatorStateState.
func (NotificationStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.notifications.pkg.apis.notifications.v0alpha1.NotificationStatusOperatorStateState"
}
