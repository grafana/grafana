// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type StaleDashboardTrackerstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State StaleDashboardTrackerStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewStaleDashboardTrackerstatusOperatorState creates a new StaleDashboardTrackerstatusOperatorState object.
func NewStaleDashboardTrackerstatusOperatorState() *StaleDashboardTrackerstatusOperatorState {
	return &StaleDashboardTrackerstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for StaleDashboardTrackerstatusOperatorState.
func (StaleDashboardTrackerstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.stalebot.pkg.apis.stalebot.v1alpha1.StaleDashboardTrackerstatusOperatorState"
}

// +k8s:openapi-gen=true
type StaleDashboardTrackerStatus struct {
	// Current stale state
	IsStale bool `json:"isStale"`
	// Last time the dashboard was accessed
	LastAccessedTime *string `json:"lastAccessedTime,omitempty"`
	// Last time the dashboard was updated
	LastUpdatedTime *string `json:"lastUpdatedTime,omitempty"`
	// Number of days since last activity
	DaysSinceActivity *int32 `json:"daysSinceActivity,omitempty"`
	// Last check timestamp
	LastCheckedTime *string `json:"lastCheckedTime,omitempty"`
	// Observed generation
	ObservedGeneration *int64 `json:"observedGeneration,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]StaleDashboardTrackerstatusOperatorState `json:"operatorStates,omitempty"`
	// Conditions
	Conditions []StaleDashboardTrackerV1alpha1StatusConditions `json:"conditions,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewStaleDashboardTrackerStatus creates a new StaleDashboardTrackerStatus object.
func NewStaleDashboardTrackerStatus() *StaleDashboardTrackerStatus {
	return &StaleDashboardTrackerStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for StaleDashboardTrackerStatus.
func (StaleDashboardTrackerStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.stalebot.pkg.apis.stalebot.v1alpha1.StaleDashboardTrackerStatus"
}

// +k8s:openapi-gen=true
type StaleDashboardTrackerV1alpha1StatusConditions struct {
	Type               string  `json:"type"`
	Status             string  `json:"status"`
	Reason             *string `json:"reason,omitempty"`
	Message            *string `json:"message,omitempty"`
	LastTransitionTime *string `json:"lastTransitionTime,omitempty"`
}

// NewStaleDashboardTrackerV1alpha1StatusConditions creates a new StaleDashboardTrackerV1alpha1StatusConditions object.
func NewStaleDashboardTrackerV1alpha1StatusConditions() *StaleDashboardTrackerV1alpha1StatusConditions {
	return &StaleDashboardTrackerV1alpha1StatusConditions{}
}

// OpenAPIModelName returns the OpenAPI model name for StaleDashboardTrackerV1alpha1StatusConditions.
func (StaleDashboardTrackerV1alpha1StatusConditions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.stalebot.pkg.apis.stalebot.v1alpha1.StaleDashboardTrackerV1alpha1StatusConditions"
}

// +k8s:openapi-gen=true
type StaleDashboardTrackerStatusOperatorStateState string

const (
	StaleDashboardTrackerStatusOperatorStateStateSuccess    StaleDashboardTrackerStatusOperatorStateState = "success"
	StaleDashboardTrackerStatusOperatorStateStateInProgress StaleDashboardTrackerStatusOperatorStateState = "in_progress"
	StaleDashboardTrackerStatusOperatorStateStateFailed     StaleDashboardTrackerStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for StaleDashboardTrackerStatusOperatorStateState.
func (StaleDashboardTrackerStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.stalebot.pkg.apis.stalebot.v1alpha1.StaleDashboardTrackerStatusOperatorStateState"
}
