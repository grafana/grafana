package v0alpha1

import "time"

#AlertRuleHealth:      "Unknown" | "OK" | "Paused" | "Error" | "NoData" | "NotScheduled"
#AlertRuleState:       "Inactive" | "Healthy" | "Firing" | "Pending" | "Recovering"
#AlertRuleStateReason: "Evaluated" | "KeepLast"

#AlertRuleStatus: {
	health?:             #AlertRuleHealth
	state?:              #AlertRuleState
	stateReason?:        #AlertRuleStateReason
	lastEvaluationTime?: string & time.Time
	evaluationDuration?: float
	lastError?:          string
}
