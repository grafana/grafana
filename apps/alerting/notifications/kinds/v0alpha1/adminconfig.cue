package v0alpha1

// AdminConfig is the per-org alerting admin config — a singleton resource
// carrying admin-controllable settings for the alerting stack. Settings are
// grouped into sections by area (e.g. alertmanager); each section's spec and
// status live in their own file (e.g. alertmanager.cue) and are embedded into
// the models below.
AdminConfigSpec: {
	// alertmanager groups admin config for the current org's Alertmanager.
	alertmanager?: #AlertmanagerSpec
}

// AdminConfigStatus reports the runtime observation of admin alerting concerns
// for an org. Written by the controllers that own fields on spec; clients read
// only.
//
// Conditions are top-level (k8s convention: meta.SetStatusCondition, kubectl
// wait --for=condition=, controller-runtime helpers). Per-area observation
// state mirrors the spec sections.
AdminConfigStatus: {
	// observedGeneration is the spec.generation last evaluated by the
	// controllers writing this status.
	observedGeneration?: int

	// alertmanager mirrors spec.alertmanager with runtime observation.
	alertmanager?: #AlertmanagerStatus

	// Standard k8s-style condition list. Each binary-state feature owns one
	// condition type. Current types:
	//   - ExternalAlertmanagerSynced: True after a successful sync, False
	//     after a failed attempt, Unknown until the first attempt.
	conditions?: [...#Condition]
}

// Condition mirrors metav1.Condition. Inlined because the app-sdk codegen
// here can't reference metav1.Condition from CUE. Field semantics are
// k8s-standard; reason values are produced by SyncReason in the syncer.
#Condition: {
	type:                string
	status:              "True" | "False" | "Unknown"
	lastTransitionTime:  string // RFC3339
	reason:              string
	message?:            string
	observedGeneration?: int
}
