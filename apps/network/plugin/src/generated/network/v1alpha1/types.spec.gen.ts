// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	// Human-readable name shown in the PDC networks list.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=190
	displayName: string;
	// Only tailscale for now. Agent networks stay on gcom access policies;
	// merging them is explicitly out of scope for #316.
	type: "tailscale";
	// Becomes the machine name Grafana registers in the customer's tailnet:
	//   grafanacloud-<stackID>-tailscale-<machineLabel>
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=63
	machineLabel: string;
}

export const defaultSpec = (): Spec => ({
	displayName: "",
	type: "tailscale",
	machineLabel: "",
});

