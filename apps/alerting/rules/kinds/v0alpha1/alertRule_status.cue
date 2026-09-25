package v0alpha1

import "time"

#AlertRuleHealth:      "Unknown" | "OK" | "Paused" | "Error" | "NoData"
#AlertRuleState:       "Inactive" | "Healthy" | "Firing" | "Pending" | "Recovering"
#AlertRuleStateReason: "Evaluated" | "KeepLast"

// Count of alert instances per state. error also counts instances whose evaluation
// errored but were mapped to another state via execErrState, so it can overlap.
#AlertRuleInstanceTotals: {
	healthy:    int
	firing:     int
	pending:    int
	recovering: int
	nodata:     int
	error:      int
}

#AlertRuleStatus: {
	health?:             #AlertRuleHealth
	state?:              #AlertRuleState
	stateReason?:        #AlertRuleStateReason
	lastEvaluationTime?: string & time.Time
	// duration of the last evaluation in seconds
	evaluationDuration?: float
	lastError?:          string
	totals?:             #AlertRuleInstanceTotals
}
