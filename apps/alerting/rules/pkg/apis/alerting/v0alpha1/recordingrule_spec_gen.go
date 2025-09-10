// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// TODO: validate that only one can specify source=true
// & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per
// +k8s:openapi-gen=true
type RecordingRuleQueryMap map[string]RecordingRuleQuery

// TODO: come up with a better name for this. We have expression type things and data source queries
// +k8s:openapi-gen=true
type RecordingRuleQuery struct {
	// TODO: consider making this optional, with the nil value meaning "__expr__" (i.e. expression query)
	QueryType         string                          `json:"queryType"`
	RelativeTimeRange *RecordingRuleRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	DatasourceUID     RecordingRuleDatasourceUID      `json:"datasourceUID"`
	Model             interface{}                     `json:"model"`
	Source            *bool                           `json:"source,omitempty"`
}

// NewRecordingRuleQuery creates a new RecordingRuleQuery object.
func NewRecordingRuleQuery() *RecordingRuleQuery {
	return &RecordingRuleQuery{}
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

// +k8s:openapi-gen=true
type RecordingRuleSpec struct {
	Title               string                                 `json:"title"`
	Data                RecordingRuleQueryMap                  `json:"data"`
	Paused              *bool                                  `json:"paused,omitempty"`
	Trigger             RecordingRuleIntervalTrigger           `json:"trigger"`
	Metric              string                                 `json:"metric"`
	Labels              map[string]RecordingRuleTemplateString `json:"labels,omitempty"`
	TargetDatasourceUID string                                 `json:"targetDatasourceUID"`
}

// NewRecordingRuleSpec creates a new RecordingRuleSpec object.
func NewRecordingRuleSpec() *RecordingRuleSpec {
	return &RecordingRuleSpec{
		Trigger: *NewRecordingRuleIntervalTrigger(),
	}
}
