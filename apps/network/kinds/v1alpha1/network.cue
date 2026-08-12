package v1alpha1

import (
	"strings"
)

NetworkSpec: {
	// Human-readable name shown in the PDC networks list.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=190
	displayName: string & strings.MinRunes(1) & strings.MaxRunes(190)

	// Only tailscale for now. Agent networks stay on gcom access policies;
	// merging them is explicitly out of scope for #316.
	type: "tailscale"

	// Becomes the machine name Grafana registers in the customer's tailnet:
	//   grafanacloud-<stackID>-tailscale-<machineLabel>
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=63
	machineLabel: string & strings.MinRunes(1) & strings.MaxRunes(63)
}

NetworkStatus: {
	// Optional. tsnet exposes node key expiry via LocalClient().Status;
	// surfacing it would be genuinely useful in the UI, but it needs a
	// reconciler. Left empty in the prototype.
	// +optional
	lastConnected?: string
}
