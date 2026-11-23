// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Mirrors metav1.StatusCause, with an additional origin field.
// +k8s:openapi-gen=true
type ConnectionErrorDetails struct {
	// Type is a machine-readable description of the cause of the error.
	// This is intended for programmatic handling and matches Kubernetes' CauseType values.
	Type string `json:"type"`
	// Field is the path to the field or JSON pointer that caused the error.
	// This helps users and tools identify exactly where to correct the problem.
	// This field is optional and may be empty if not applicable.
	Field *string `json:"field,omitempty"`
	// Detail provides a human-readable explanation of what went wrong.
	// This message may be shown directly to users and should be actionable.
	Detail *string `json:"detail,omitempty"`
	// Origin indicates where the error originated in validation, or the name of the external
	// service that reported the error. This can be useful for tooling or debugging,
	// and may reference a specific rule, function, or service. This field is optional and may be empty.
	Origin *string `json:"origin,omitempty"`
	// BadValue is the value of the field that was determined to be invalid, if applicable.
	// This can be any type. This field is optional and may be omitted if not relevant.
	BadValue interface{} `json:"badValue,omitempty"`
}

// NewConnectionErrorDetails creates a new ConnectionErrorDetails object.
func NewConnectionErrorDetails() *ConnectionErrorDetails {
	return &ConnectionErrorDetails{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionErrorDetails.
func (ConnectionErrorDetails) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionErrorDetails"
}

// Mirrors metav1.Condition, which CUE cannot reference directly.
// +k8s:openapi-gen=true
type ConnectionCondition struct {
	// type of condition in CamelCase or in foo.example.com/CamelCase.
	Type string `json:"type"`
	// status of the condition, one of True, False, Unknown.
	Status string `json:"status"`
	// observedGeneration represents the .metadata.generation that the condition was set based upon.
	ObservedGeneration *int64 `json:"observedGeneration,omitempty"`
	// lastTransitionTime is the last time the condition transitioned from one status to another.
	// Null when unset, matching the encoding of the zero metav1.Time.
	LastTransitionTime *string `json:"lastTransitionTime"`
	// reason contains a programmatic identifier indicating the reason for the condition's last transition.
	Reason string `json:"reason"`
	// message is a human readable message indicating details about the transition.
	Message string `json:"message"`
}

// NewConnectionCondition creates a new ConnectionCondition object.
func NewConnectionCondition() *ConnectionCondition {
	return &ConnectionCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionCondition.
func (ConnectionCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionCondition"
}

// +k8s:openapi-gen=true
type ConnectionHealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`
	// The type of the error
	Error *ConnectionHealthFailureType `json:"error,omitempty"`
	// When the health was checked last time
	Checked *int64 `json:"checked,omitempty"`
	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	// +listType=atomic
	Message []string `json:"message,omitempty"`
}

// NewConnectionHealthStatus creates a new ConnectionHealthStatus object.
func NewConnectionHealthStatus() *ConnectionHealthStatus {
	return &ConnectionHealthStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionHealthStatus.
func (ConnectionHealthStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionHealthStatus"
}

// +enum
// +k8s:openapi-gen=true
type ConnectionHealthFailureType string

const (
	ConnectionHealthFailureTypeHook   ConnectionHealthFailureType = "hook"
	ConnectionHealthFailureTypeHealth ConnectionHealthFailureType = "health"
)

// OpenAPIModelName returns the OpenAPI model name for ConnectionHealthFailureType.
func (ConnectionHealthFailureType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionHealthFailureType"
}

// +k8s:openapi-gen=true
type ConnectionTokenStatus struct {
	LastUpdated *int64 `json:"lastUpdated,omitempty"`
	Expiration  *int64 `json:"expiration,omitempty"`
}

// NewConnectionTokenStatus creates a new ConnectionTokenStatus object.
func NewConnectionTokenStatus() *ConnectionTokenStatus {
	return &ConnectionTokenStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionTokenStatus.
func (ConnectionTokenStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionTokenStatus"
}

// +k8s:openapi-gen=true
type ConnectionStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration int64 `json:"observedGeneration"`
	// FieldErrors are errors that occurred during validation of the connection spec.
	// These errors are intended to help users identify and fix issues in the spec.
	// +listType=atomic
	FieldErrors []ConnectionErrorDetails `json:"fieldErrors,omitempty"`
	// Conditions represent the latest available observations of the connection's state.
	// +listType=map
	// +listMapKey=type
	// +patchMergeKey=type
	// +patchStrategy=merge
	Conditions []ConnectionCondition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type"`
	// The connection health status
	Health ConnectionHealthStatus `json:"health"`
	// Token holds metadata about the last generated connection token, used to avoid
	// regenerating a token whose secret was written recently but is not yet readable.
	Token ConnectionTokenStatus `json:"token"`
}

// NewConnectionStatus creates a new ConnectionStatus object.
func NewConnectionStatus() *ConnectionStatus {
	return &ConnectionStatus{
		Health: *NewConnectionHealthStatus(),
		Token:  *NewConnectionTokenStatus(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionStatus.
func (ConnectionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionStatus"
}
