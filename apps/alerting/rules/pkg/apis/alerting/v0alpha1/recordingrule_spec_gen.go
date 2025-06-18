// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RecordingRuleQuery struct {
	QueryType         string                         `json:"queryType"`
	RelativeTimeRange RecordingRuleRelativeTimeRange `json:"relativeTimeRange"`
	DatasourceUID     RecordingRuleDatasourceUID     `json:"datasourceUID"`
	Model             interface{}                    `json:"model"`
	Source            *bool                          `json:"source,omitempty"`
}

// NewRecordingRuleQuery creates a new RecordingRuleQuery object.
func NewRecordingRuleQuery() *RecordingRuleQuery {
	return &RecordingRuleQuery{
		RelativeTimeRange: *NewRecordingRuleRelativeTimeRange(),
	}
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

// TODO(@moustafab): validate regex for datasource UID
// +k8s:openapi-gen=true
type RecordingRuleDatasourceUID string

// +k8s:openapi-gen=true
type RecordingRulePromDuration string

// =~ figure out the regex for the template string
// +k8s:openapi-gen=true
type RecordingRuleTemplateString string

// +k8s:openapi-gen=true
type RecordingRuleSpec struct {
	Title               string                                 `json:"title"`
	Paused              *bool                                  `json:"paused,omitempty"`
	Data                map[string]RecordingRuleQuery          `json:"data"`
	Interval            RecordingRulePromDuration              `json:"interval"`
	Metric              string                                 `json:"metric"`
	Labels              map[string]RecordingRuleTemplateString `json:"labels"`
	TargetDatasourceUID string                                 `json:"targetDatasourceUID"`
}

// NewRecordingRuleSpec creates a new RecordingRuleSpec object.
func NewRecordingRuleSpec() *RecordingRuleSpec {
	return &RecordingRuleSpec{
		Data:   map[string]RecordingRuleQuery{},
		Labels: map[string]RecordingRuleTemplateString{},
	}
}
