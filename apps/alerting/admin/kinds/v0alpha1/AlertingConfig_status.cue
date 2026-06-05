package v0alpha1

// AlertingConfigStatus reports the runtime observation of admin alerting
// concerns for an org. Written by the controllers that own fields on spec;
// clients read only.
//
// Conditions are top-level (k8s convention: meta.SetStatusCondition, kubectl
// wait --for=condition=, controller-runtime helpers). Auxiliary observation
// state is nested per-feature so spec and status read symmetrically.
AlertingConfigStatus: {
	// observedGeneration is the spec.generation last evaluated by the
	// controllers writing this status.
	observedGeneration?: int

	// externalAlertmanagerSync mirrors the spec sub-object with runtime
	// observation. Conditions for this feature live at
	// .status.conditions[type=ExternalAlertmanagerSynced].
	externalAlertmanagerSync?: {
		// datasourceUid is the UID actually used on the last sync attempt;
		// may lag spec until the next tick. When origin=ini, this is the
		// ini override value.
		datasourceUid?: string

		// origin records which source supplied datasourceUid on the last run.
		// "ini" (grafana.ini's unified_alerting.external_alertmanager_uid)
		// wins over "api" (spec.externalAlertmanagerSync.datasourceUid).
		origin?: "api" | "ini"
	}

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
