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

export interface Status {
	// Optional. tsnet exposes node key expiry via LocalClient().Status;
	// surfacing it would be genuinely useful in the UI, but it needs a
	// reconciler. Left empty in the prototype.
	// +optional
	lastConnected?: string;
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	operatorStates?: Record<string, OperatorState>;
	// additionalFields is reserved for future use
	additionalFields?: Record<string, any>;
}

export const defaultStatus = (): Status => ({
});

