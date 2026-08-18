// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Spec mirrors coordination.k8s.io/v1 LeaseSpec. Timestamps are RFC3339
// strings (sub-second precision) rather than metav1.MicroTime, consistent
// with other app-platform kinds; the client adapter converts.
// +k8s:openapi-gen=true
type LeaseSpec struct {
	// holderIdentity is the identity of the current holder, "<pod>_<uid>" by convention.
	HolderIdentity *string `json:"holderIdentity,omitempty"`
	// leaseDurationSeconds is how long a candidate must wait after renewTime
	// before taking over. Bounds (floor 10s to cap the fleet-wide write rate,
	// ceiling 600s to keep worst-case takeover under ~10 minutes) are enforced
	// by the admission validator so the field stays int32, matching k8s.
	LeaseDurationSeconds *int32 `json:"leaseDurationSeconds,omitempty"`
	// acquireTime is when the current holder first acquired the lease (RFC3339).
	AcquireTime *string `json:"acquireTime,omitempty"`
	// renewTime is the last renewal; holders update this on every renew (RFC3339).
	RenewTime *string `json:"renewTime,omitempty"`
	// leaseTransitions is incremented each time the holder changes.
	LeaseTransitions *int32 `json:"leaseTransitions,omitempty"`
	// strategy is reserved for coordinated/preference-based election (k8s KEP-4355).
	Strategy *string `json:"strategy,omitempty"`
	// preferredHolder is reserved for coordinated/preference-based election (k8s KEP-4355).
	PreferredHolder *string `json:"preferredHolder,omitempty"`
}

// NewLeaseSpec creates a new LeaseSpec object.
func NewLeaseSpec() *LeaseSpec {
	return &LeaseSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for LeaseSpec.
func (LeaseSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.LeaseSpec"
}
