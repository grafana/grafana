// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface OperatorState {
	// lastEvaluation is the ResourceVersion last evaluated
	lastEvaluation: string;
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	state: "success" | "in_progress" | "failed";
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	descriptiveState?: string;
	// details contains any extra information that is operator-specific
	details?: Record<string, any>;
}

export const defaultOperatorState = (): OperatorState => ({
	lastEvaluation: "",
	state: "success",
});

// Condition mirrors metav1.Condition. Inlined because the app-sdk codegen
// here can't reference metav1.Condition from CUE. Field semantics are
// k8s-standard; reason values are produced by SyncReason in the syncer.
export interface Condition {
	type: string;
	status: "True" | "False" | "Unknown";
	// RFC3339
	lastTransitionTime: string;
	reason: string;
	message?: string;
	observedGeneration?: number;
}

export const defaultCondition = (): Condition => ({
	type: "",
	status: "True",
	lastTransitionTime: "",
	reason: "",
});

export interface Status {
	// observedGeneration is the spec.generation last evaluated by the
	// controllers writing this status.
	observedGeneration?: number;
	externalRulerSync?: {
		// datasourceUid is the UID actually used on the last sync attempt; may lag
		// spec until the next tick. When origin=ini, this is the ini override value.
		datasourceUid?: string;
		// origin records which source supplied datasourceUid on the last run. "ini"
		// (grafana.ini's unified_alerting.external_ruler_uid) wins over "api"
		// (spec.externalRulerSync.datasourceUid).
		origin?: "api" | "ini";
	};
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	operatorStates?: Record<string, OperatorState>;
	// Standard k8s-style condition list. Each binary-state feature owns one
	// condition type. Current types:
	//   - ExternalRulerSynced: True after a successful sync, False after a
	//     failed attempt, Unknown until the first attempt.
	conditions?: Condition[];
	// additionalFields is reserved for future use
	additionalFields?: Record<string, any>;
}

export const defaultStatus = (): Status => ({
});

