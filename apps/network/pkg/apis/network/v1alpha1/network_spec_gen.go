// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type NetworkSpec struct {
	// Human-readable name shown in the PDC networks list.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=190
	DisplayName string `json:"displayName"`
	// Only tailscale for now. Agent networks stay on gcom access policies;
	// merging them is explicitly out of scope for #316.
	Type string `json:"type"`
	// Becomes the machine name Grafana registers in the customer's tailnet:
	//   grafanacloud-<stackID>-tailscale-<machineLabel>
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=63
	MachineLabel string `json:"machineLabel"`
}

// NewNetworkSpec creates a new NetworkSpec object.
func NewNetworkSpec() *NetworkSpec {
	return &NetworkSpec{
		Type: "tailscale",
	}
}

// OpenAPIModelName returns the OpenAPI model name for NetworkSpec.
func (NetworkSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.network.pkg.apis.network.v1alpha1.NetworkSpec"
}
