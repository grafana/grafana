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

// status tracks the child resources currently owned by this PrometheusRuleFile.
// It is the source of truth used by the reconciler to prune children that no longer
// appear in the spec — AlertRules and RecordingRules live in legacy storage which does
// not preserve arbitrary labels, so name-based bookkeeping in status is the only
// reliable way to find what we previously created.
export interface Status {
	managedFolders?: string[];
	managedAlertRules?: string[];
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	operatorStates?: Record<string, OperatorState>;
	managedRecordingRules?: string[];
	// additionalFields is reserved for future use
	additionalFields?: Record<string, any>;
}

export const defaultStatus = (): Status => ({
});

