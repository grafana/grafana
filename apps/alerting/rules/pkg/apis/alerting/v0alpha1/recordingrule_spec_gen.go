// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RecordingRuleIntervalTrigger struct {
	Interval RecordingRulePromDuration `json:"interval"`
}

// NewRecordingRuleIntervalTrigger creates a new RecordingRuleIntervalTrigger object.
func NewRecordingRuleIntervalTrigger() *RecordingRuleIntervalTrigger {
	return &RecordingRuleIntervalTrigger{}
}

// +k8s:openapi-gen=true
type RecordingRulePromDuration string

// +k8s:openapi-gen=true
type RecordingRuleTemplateString string

// TODO: validate that only one can specify source=true
// & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per
// +k8s:openapi-gen=true
type RecordingRuleExpressionMap map[string]RecordingRuleExpression

// +k8s:openapi-gen=true
type RecordingRuleExpression struct {
	// The type of query if this is a query expression
	QueryType         *string                         `json:"queryType,omitempty"`
	RelativeTimeRange *RecordingRuleRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	// The UID of the datasource to run this expression against. If omitted, the expression will be run against the `__expr__` datasource
	DatasourceUID *RecordingRuleDatasourceUID `json:"datasourceUID,omitempty"`
	Model         interface{}                 `json:"model"`
	// Used to mark the expression to be used as the final source for the rule evaluation
	// Only one expression in a rule can be marked as the source
	// For AlertRules, this is the expression that will be evaluated against the alerting condition
	// For RecordingRules, this is the expression that will be recorded
	Source *bool `json:"source,omitempty"`
}

// NewRecordingRuleExpression creates a new RecordingRuleExpression object.
func NewRecordingRuleExpression() *RecordingRuleExpression {
	return &RecordingRuleExpression{}
}

// +k8s:openapi-gen=true
type RecordingRuleRelativeTimeRange struct {
	From RecordingRulePromDurationWMillis `json:"from"`
	To   RecordingRulePromDurationWMillis `json:"to"`
}

// NewRecordingRuleRelativeTimeRange creates a new RecordingRuleRelativeTimeRange object.
func NewRecordingRuleRelativeTimeRange() *RecordingRuleRelativeTimeRange {
	return &RecordingRuleRelativeTimeRange{}
}

// +k8s:openapi-gen=true
type RecordingRulePromDurationWMillis string

// +k8s:openapi-gen=true
type RecordingRuleDatasourceUID string

// +k8s:openapi-gen=true
type RecordingRuleSpec struct {
	Title               string                                 `json:"title"`
	Paused              *bool                                  `json:"paused,omitempty"`
	Trigger             RecordingRuleIntervalTrigger           `json:"trigger"`
	Labels              map[string]RecordingRuleTemplateString `json:"labels,omitempty"`
	Metric              string                                 `json:"metric"`
	Expressions         RecordingRuleExpressionMap             `json:"expressions"`
	TargetDatasourceUID string                                 `json:"targetDatasourceUID"`
}

// NewRecordingRuleSpec creates a new RecordingRuleSpec object.
func NewRecordingRuleSpec() *RecordingRuleSpec {
	return &RecordingRuleSpec{
		Trigger: *NewRecordingRuleIntervalTrigger(),
	}
}
