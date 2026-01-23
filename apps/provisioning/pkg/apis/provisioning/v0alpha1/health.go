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

	// ConditionTypeQuota indicates whether the resource is within configured quota limits.
	// This is an aggregated condition that can track multiple quota types (resources, storage, etc.).
	// True = within quota or no limits configured, False = quota reached or exceeded.
	ConditionTypeQuota = "Quota"
)

// Condition reasons for the Ready condition
const (
	// ReasonAvailable indicates the resource is available and ready for use.
	ReasonAvailable = "Available"
	// ReasonUnavailable indicates the resource is unavailable and not ready.
	ReasonUnavailable = "Unavailable"
)

// Condition reasons for the Quota condition
const (
	// ReasonWithinQuota indicates all quota limits are satisfied.
	ReasonWithinQuota = "WithinQuota"
	// ReasonQuotaUnlimited indicates no quota limits are configured.
	ReasonQuotaUnlimited = "QuotaUnlimited"
	// ReasonResourceQuotaReached indicates the resource count is exactly at the limit.
	ReasonResourceQuotaReached = "ResourceQuotaReached"
	// ReasonResourceQuotaExceeded indicates the resource count exceeds the limit.
	ReasonResourceQuotaExceeded = "ResourceQuotaExceeded"
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
