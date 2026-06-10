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

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleIntervalTrigger.
func (RecordingRuleIntervalTrigger) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleIntervalTrigger"
}

// +k8s:openapi-gen=true
type RecordingRulePromDuration string

// +k8s:openapi-gen=true
type RecordingRuleTemplateString string

// +k8s:openapi-gen=true
type RecordingRuleMetricName string

// +k8s:openapi-gen=true
type RecordingRuleExpressionMap map[string]RecordingRuleExpression

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleExpressionMap.
func (RecordingRuleExpressionMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleExpressionMap"
}

// +k8s:openapi-gen=true
type RecordingRuleExpression struct {
	QueryType         *string                         `json:"queryType,omitempty"`
	RelativeTimeRange *RecordingRuleRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	DatasourceUID     *RecordingRuleDatasourceUID     `json:"datasourceUID,omitempty"`
	Model             interface{}                     `json:"model"`
	Source            *bool                           `json:"source,omitempty"`
}

// NewRecordingRuleExpression creates a new RecordingRuleExpression object.
func NewRecordingRuleExpression() *RecordingRuleExpression {
	return &RecordingRuleExpression{}
}

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleExpression.
func (RecordingRuleExpression) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleExpression"
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

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleRelativeTimeRange.
func (RecordingRuleRelativeTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleRelativeTimeRange"
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
	Metric              RecordingRuleMetricName                `json:"metric"`
	Expressions         RecordingRuleExpressionMap             `json:"expressions"`
	TargetDatasourceUID RecordingRuleDatasourceUID             `json:"targetDatasourceUID"`
}

// NewRecordingRuleSpec creates a new RecordingRuleSpec object.
func NewRecordingRuleSpec() *RecordingRuleSpec {
	return &RecordingRuleSpec{
		Trigger: *NewRecordingRuleIntervalTrigger(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleSpec.
func (RecordingRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleSpec"
}
