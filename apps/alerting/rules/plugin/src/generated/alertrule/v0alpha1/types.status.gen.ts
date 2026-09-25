// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export enum AlertRuleHealth {
	Unknown = "Unknown",
	OK = "OK",
	Paused = "Paused",
	Error = "Error",
	NoData = "NoData",
}

export const defaultAlertRuleHealth = (): AlertRuleHealth => (AlertRuleHealth.Unknown);

export enum AlertRuleState {
	Inactive = "Inactive",
	Healthy = "Healthy",
	Firing = "Firing",
	Pending = "Pending",
	Recovering = "Recovering",
}

export const defaultAlertRuleState = (): AlertRuleState => (AlertRuleState.Inactive);

export enum AlertRuleStateReason {
	Evaluated = "Evaluated",
	KeepLast = "KeepLast",
}

export const defaultAlertRuleStateReason = (): AlertRuleStateReason => (AlertRuleStateReason.Evaluated);

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

/**
 * Count of alert instances per state. error also counts instances whose evaluation
 * errored but were mapped to another state via execErrState, so it can overlap.
 */
export interface AlertRuleInstanceTotals {
	healthy: number;
	firing: number;
	pending: number;
	recovering: number;
	nodata: number;
	error: number;
}

export const defaultAlertRuleInstanceTotals = (): AlertRuleInstanceTotals => ({
	healthy: 0,
	firing: 0,
	pending: 0,
	recovering: 0,
	nodata: 0,
	error: 0,
});

export interface Status {
	health?: AlertRuleHealth;
	state?: AlertRuleState;
	stateReason?: AlertRuleStateReason;
	lastEvaluationTime?: string;
	// duration of the last evaluation in seconds
	evaluationDuration?: number;
	lastError?: string;
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	operatorStates?: Record<string, OperatorState>;
	totals?: AlertRuleInstanceTotals;
	// additionalFields is reserved for future use
	additionalFields?: Record<string, any>;
}

export const defaultStatus = (): Status => ({
});

