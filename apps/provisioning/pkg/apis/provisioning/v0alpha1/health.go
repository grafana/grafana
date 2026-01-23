package v0alpha1

// HealthFailureType represents different types of healthcheck failures
// +enum
type HealthFailureType string

const (
	HealthFailureHook   HealthFailureType = "hook"
	HealthFailureHealth HealthFailureType = "health"
)

// Condition types for Repository and Connection resources
const (
	// ConditionTypeReady indicates that the resource is ready for use.
	// For repositories and connections, this reflects whether the health check is passing.
	ConditionTypeReady = "Ready"
)

// Condition reasons for the Ready condition
const (
	// ReasonAvailable indicates the resource is available and ready for use.
	ReasonAvailable = "Available"

	// ReasonInvalidSpec indicates the resource has a configuration issue
	// with the spec format or structure (validation errors, invalid fields, secret errors).
	// Automation should NOT automatically retry - wait for user to fix configuration.
	ReasonInvalidSpec = "InvalidSpec"

	// ReasonAuthenticationFailed indicates authentication or authorization failed
	// (invalid credentials, wrong app ID, expired token, insufficient permissions).
	// Automation should NOT automatically retry - wait for user to fix credentials.
	ReasonAuthenticationFailed = "AuthenticationFailed"

	// ReasonServiceUnavailable indicates an external service issue (API down, network timeout).
	// Automation CAN retry with standard backoff - the issue is transient and outside user control.
	ReasonServiceUnavailable = "ServiceUnavailable"

	// ReasonRateLimited indicates the external service is rate limiting requests.
	// User may need to take action (upgrade plan, reduce load). Automation should retry with
	// longer backoff and respect Retry-After headers.
	ReasonRateLimited = "RateLimited"
)

type HealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`

	// The type of the error
	Error HealthFailureType `json:"error,omitempty"`

	// When the health was checked last time
	Checked int64 `json:"checked,omitempty"`

	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	// +listType=atomic
	Message []string `json:"message,omitempty"`
}
