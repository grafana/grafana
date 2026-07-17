package v0alpha1

import "time"

#RecordingRuleHealth: "Unknown" | "Recording" | "Paused" | "Error" | "NoData" | "NotScheduled"

#RecordingRuleStatus: {
	health?:             #RecordingRuleHealth
	lastEvaluationTime?: string & time.Time
	evaluationTime?:     float
	lastError?:          string
}
