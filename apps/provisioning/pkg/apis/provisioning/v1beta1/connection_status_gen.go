// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// ErrorDetails describes an individual field error intended to help users identify and fix issues
// in resource specifications. This type is modeled after Kubernetes' StatusCause and serves the same
// purpose: to deliver actionable feedback about fields in the spec that require attention.
// Errors may relate to invalid formats, missing or invalid values, or cases where a referenced value
// does not exist in an external system (not strictly format or syntax errors). Use ErrorDetails to
// communicate validation or external reference errors that users can resolve by editing spec fields.
// TODO: Rename this type to FieldError for consistency with Kubernetes conventions and to more clearly indicate that it represents field-level validation errors, not arbitrary error details.
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
	// Origin indicates where the error originated in validation, or the name of the external service that reported the error.
	// This can be useful for tooling or debugging, and may reference a specific rule, function, or service.
	// This field is optional and may be empty.
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
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionErrorDetails"
}

// +k8s:openapi-gen=true
type ConnectionCondition struct {
	Type               string                    `json:"type"`
	Status             ConnectionConditionStatus `json:"status"`
	ObservedGeneration *int64                    `json:"observedGeneration,omitempty"`
	LastTransitionTime string                    `json:"lastTransitionTime"`
	Reason             string                    `json:"reason"`
	Message            string                    `json:"message"`
}

// NewConnectionCondition creates a new ConnectionCondition object.
func NewConnectionCondition() *ConnectionCondition {
	return &ConnectionCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionCondition.
func (ConnectionCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionCondition"
}

// +k8s:openapi-gen=true
type ConnectionHealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`
	// The type of the error
	Error *ConnectionHealthStatusError `json:"error,omitempty"`
	// When the health was checked last time
	Checked *int64 `json:"checked,omitempty"`
	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	Message []string `json:"message,omitempty"`
}

// NewConnectionHealthStatus creates a new ConnectionHealthStatus object.
func NewConnectionHealthStatus() *ConnectionHealthStatus {
	return &ConnectionHealthStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionHealthStatus.
func (ConnectionHealthStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionHealthStatus"
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
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionTokenStatus"
}

// +k8s:openapi-gen=true
type ConnectionStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration int64 `json:"observedGeneration"`
	// FieldErrors are errors that occurred during validation of the connection spec.
	// These errors are intended to help users identify and fix issues in the spec.
	FieldErrors []ConnectionErrorDetails `json:"fieldErrors,omitempty"`
	// Conditions represent the latest available observations of the connection's state.
	Conditions []ConnectionCondition `json:"conditions,omitempty"`
	// The connection health status
	Health ConnectionHealthStatus `json:"health"`
	// Token holds metadata about the last generated connection token, used to avoid
	// regenerating a token whose secret was written recently but is not yet readable.
	Token *ConnectionTokenStatus `json:"token,omitempty"`
}

// NewConnectionStatus creates a new ConnectionStatus object.
func NewConnectionStatus() *ConnectionStatus {
	return &ConnectionStatus{
		Health: *NewConnectionHealthStatus(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionStatus.
func (ConnectionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionStatus"
}

// +k8s:openapi-gen=true
type ConnectionConditionStatus string

const (
	ConnectionConditionStatusTrue    ConnectionConditionStatus = "True"
	ConnectionConditionStatusFalse   ConnectionConditionStatus = "False"
	ConnectionConditionStatusUnknown ConnectionConditionStatus = "Unknown"
)

// OpenAPIModelName returns the OpenAPI model name for ConnectionConditionStatus.
func (ConnectionConditionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionConditionStatus"
}

// +k8s:openapi-gen=true
type ConnectionHealthStatusError string

const (
	ConnectionHealthStatusErrorHook   ConnectionHealthStatusError = "hook"
	ConnectionHealthStatusErrorHealth ConnectionHealthStatusError = "health"
)

// OpenAPIModelName returns the OpenAPI model name for ConnectionHealthStatusError.
func (ConnectionHealthStatusError) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionHealthStatusError"
}
