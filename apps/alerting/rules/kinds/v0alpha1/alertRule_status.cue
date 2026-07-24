package v0alpha1

import "time"

#AlertRuleHealth: "Unknown" | "OK" | "Paused" | "Error" | "NoData" | "NotScheduled"
#AlertRuleState:  "Inactive" | "Normal" | "Firing" | "Pending" | "Recovering"

#AlertRuleStatus: {
	health?:             #AlertRuleHealth
	state?:              #AlertRuleState
	lastEvaluationTime?: string & time.Time
	evaluationDuration?: float
	lastError?:          string
}
