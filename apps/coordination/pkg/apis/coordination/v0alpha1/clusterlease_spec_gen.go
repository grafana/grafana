// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ClusterLeaseSpec struct {
	// holderIdentity is the identity of the current holder, "<pod>_<uid>" by convention.
	HolderIdentity *string `json:"holderIdentity,omitempty"`
	// leaseDurationSeconds is how long a candidate must wait after renewTime before
	// taking over. Bounds (floor 10s to cap the fleet-wide write rate, ceiling 600s to
	// keep worst-case takeover under ~10 minutes) are enforced by the admission
	// validator so the field stays int32, matching k8s.
	LeaseDurationSeconds *int32 `json:"leaseDurationSeconds,omitempty"`
	// acquireTime is when the current holder first acquired the lease (RFC3339).
	AcquireTime *string `json:"acquireTime,omitempty"`
	// renewTime is the last renewal; holders update this on every renew (RFC3339).
	RenewTime *string `json:"renewTime,omitempty"`
	// leaseTransitions is incremented each time the holder changes.
	LeaseTransitions *int32 `json:"leaseTransitions,omitempty"`
}

// NewClusterLeaseSpec creates a new ClusterLeaseSpec object.
func NewClusterLeaseSpec() *ClusterLeaseSpec {
	return &ClusterLeaseSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ClusterLeaseSpec.
func (ClusterLeaseSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.ClusterLeaseSpec"
}
