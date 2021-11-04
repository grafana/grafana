package pipeline

// ConditionType represents multiple condition operator type.
type ConditionType string

// Known condition types.
const (
	ConditionAll ConditionType = "all"
	ConditionAny ConditionType = "any"
)
