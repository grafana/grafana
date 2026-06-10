// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchRecordingRulesRecordingRuleHit struct {
	Metadata interface{}                              `json:"metadata"`
	Spec     GetSearchRecordingRulesRecordingRuleSpec `json:"spec"`
}

// NewGetSearchRecordingRulesRecordingRuleHit creates a new GetSearchRecordingRulesRecordingRuleHit object.
func NewGetSearchRecordingRulesRecordingRuleHit() *GetSearchRecordingRulesRecordingRuleHit {
	return &GetSearchRecordingRulesRecordingRuleHit{
		Spec: *NewGetSearchRecordingRulesRecordingRuleSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRecordingRuleHit.
func (GetSearchRecordingRulesRecordingRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRecordingRuleHit"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesRecordingRuleSpec struct {
	Title               string                                           `json:"title"`
	Paused              *bool                                            `json:"paused,omitempty"`
	Trigger             GetSearchRecordingRulesIntervalTrigger           `json:"trigger"`
	Labels              map[string]GetSearchRecordingRulesTemplateString `json:"labels,omitempty"`
	Metric              GetSearchRecordingRulesMetricName                `json:"metric"`
	Expressions         GetSearchRecordingRulesExpressionMap             `json:"expressions"`
	TargetDatasourceUID GetSearchRecordingRulesDatasourceUID             `json:"targetDatasourceUID"`
}

// NewGetSearchRecordingRulesRecordingRuleSpec creates a new GetSearchRecordingRulesRecordingRuleSpec object.
func NewGetSearchRecordingRulesRecordingRuleSpec() *GetSearchRecordingRulesRecordingRuleSpec {
	return &GetSearchRecordingRulesRecordingRuleSpec{
		Trigger: *NewGetSearchRecordingRulesIntervalTrigger(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRecordingRuleSpec.
func (GetSearchRecordingRulesRecordingRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRecordingRuleSpec"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesIntervalTrigger struct {
	Interval GetSearchRecordingRulesPromDuration `json:"interval"`
}

// NewGetSearchRecordingRulesIntervalTrigger creates a new GetSearchRecordingRulesIntervalTrigger object.
func NewGetSearchRecordingRulesIntervalTrigger() *GetSearchRecordingRulesIntervalTrigger {
	return &GetSearchRecordingRulesIntervalTrigger{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesIntervalTrigger.
func (GetSearchRecordingRulesIntervalTrigger) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesIntervalTrigger"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesPromDuration string

// +k8s:openapi-gen=true
type GetSearchRecordingRulesTemplateString string

// +k8s:openapi-gen=true
type GetSearchRecordingRulesMetricName string

// +k8s:openapi-gen=true
type GetSearchRecordingRulesExpressionMap map[string]GetSearchRecordingRulesExpression

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesExpressionMap.
func (GetSearchRecordingRulesExpressionMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesExpressionMap"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesExpression struct {
	QueryType         *string                                   `json:"queryType,omitempty"`
	RelativeTimeRange *GetSearchRecordingRulesRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	DatasourceUID     *GetSearchRecordingRulesDatasourceUID     `json:"datasourceUID,omitempty"`
	Model             interface{}                               `json:"model"`
	Source            *bool                                     `json:"source,omitempty"`
}

// NewGetSearchRecordingRulesExpression creates a new GetSearchRecordingRulesExpression object.
func NewGetSearchRecordingRulesExpression() *GetSearchRecordingRulesExpression {
	return &GetSearchRecordingRulesExpression{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesExpression.
func (GetSearchRecordingRulesExpression) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesExpression"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesRelativeTimeRange struct {
	From GetSearchRecordingRulesPromDurationWMillis `json:"from"`
	To   GetSearchRecordingRulesPromDurationWMillis `json:"to"`
}

// NewGetSearchRecordingRulesRelativeTimeRange creates a new GetSearchRecordingRulesRelativeTimeRange object.
func NewGetSearchRecordingRulesRelativeTimeRange() *GetSearchRecordingRulesRelativeTimeRange {
	return &GetSearchRecordingRulesRelativeTimeRange{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRelativeTimeRange.
func (GetSearchRecordingRulesRelativeTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRelativeTimeRange"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesPromDurationWMillis string

// +k8s:openapi-gen=true
type GetSearchRecordingRulesDatasourceUID string

// +k8s:openapi-gen=true
type GetSearchRecordingRulesBody struct {
	Items []GetSearchRecordingRulesRecordingRuleHit `json:"items"`
}

// NewGetSearchRecordingRulesBody creates a new GetSearchRecordingRulesBody object.
func NewGetSearchRecordingRulesBody() *GetSearchRecordingRulesBody {
	return &GetSearchRecordingRulesBody{
		Items: []GetSearchRecordingRulesRecordingRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesBody.
func (GetSearchRecordingRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesBody"
}
