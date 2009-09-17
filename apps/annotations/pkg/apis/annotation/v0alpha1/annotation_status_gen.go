// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AnnotationstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State AnnotationStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewAnnotationstatusOperatorState creates a new AnnotationstatusOperatorState object.
func NewAnnotationstatusOperatorState() *AnnotationstatusOperatorState {
	return &AnnotationstatusOperatorState{}
}

// +k8s:openapi-gen=true
type AnnotationStatus struct {
	// System metadata (read-only)
	// Creation timestamp (epoch milliseconds)
	Created *int64 `json:"created,omitempty"`
	// Last update timestamp (epoch milliseconds)
	Updated *int64 `json:"updated,omitempty"`
	// User information (populated by system)
	// Internal user ID
	UserId *int64 `json:"userId,omitempty"`
	// User login name
	UserLogin *string `json:"userLogin,omitempty"`
	// User email
	UserEmail *string `json:"userEmail,omitempty"`
	// User avatar URL
	AvatarUrl *string `json:"avatarUrl,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]AnnotationstatusOperatorState `json:"operatorStates,omitempty"`
	// Alert information (for alert annotations)
	// Legacy fields (may be removed in future)
	// dashboardId?: int64  // Legacy dashboard ID (deprecated)
	// type?: string        // Legacy type field
	// title?: string       // Legacy title field
	// Alert rule name
	AlertName *string `json:"alertName,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewAnnotationStatus creates a new AnnotationStatus object.
func NewAnnotationStatus() *AnnotationStatus {
	return &AnnotationStatus{}
}

// +k8s:openapi-gen=true
type AnnotationStatusOperatorStateState string

const (
	AnnotationStatusOperatorStateStateSuccess    AnnotationStatusOperatorStateState = "success"
	AnnotationStatusOperatorStateStateInProgress AnnotationStatusOperatorStateState = "in_progress"
	AnnotationStatusOperatorStateStateFailed     AnnotationStatusOperatorStateState = "failed"
)
