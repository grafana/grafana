// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Report {
	// Number of elements analyzed
	count: number;
	// List of failures
	failures: ReportFailure[];
}

export const defaultReport = (): Report => ({
	count: 0,
	failures: [],
});

export interface ReportFailure {
	// Severity of the failure
	severity: "high" | "low";
	// Step ID that the failure is associated with
	stepID: string;
	// Human readable identifier of the item that failed
	item: string;
	// ID of the item that failed
	itemID: string;
	// Links to actions that can be taken to resolve the failure
	links: ErrorLink[];
	// More information about the failure, not meant to be displayed to the user. Used for LLM suggestions.
	moreInfo?: string;
}

export const defaultReportFailure = (): ReportFailure => ({
	severity: "high",
	stepID: "",
	item: "",
	itemID: "",
	links: [],
});

export interface ErrorLink {
	// URL to a page with more information about the error
	url: string;
	// Human readable error message
	message: string;
}

export const defaultErrorLink = (): ErrorLink => ({
	url: "",
	message: "",
});

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
	report: Report;
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	operatorStates?: Record<string, OperatorState>;
	// additionalFields is reserved for future use
	additionalFields?: Record<string, any>;
}

export const defaultStatus = (): Status => ({
	report: defaultReport(),
});

