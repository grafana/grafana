// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
)

// +k8s:openapi-gen=true
type GetSearchRulesRuleHit struct {
	Metadata interface{} `json:"metadata"`
	Spec     interface{} `json:"spec"`
}

// NewGetSearchRulesRuleHit creates a new GetSearchRulesRuleHit object.
func NewGetSearchRulesRuleHit() *GetSearchRulesRuleHit {
	return &GetSearchRulesRuleHit{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRuleHit.
func (GetSearchRulesRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRuleHit"
}

// +k8s:openapi-gen=true
type GetSearchRulesAlertRuleSpec struct {
	Title                       string                                  `json:"title"`
	Paused                      *bool                                   `json:"paused,omitempty"`
	Trigger                     GetSearchRulesIntervalTrigger           `json:"trigger"`
	Labels                      map[string]GetSearchRulesTemplateString `json:"labels,omitempty"`
	Annotations                 map[string]GetSearchRulesTemplateString `json:"annotations,omitempty"`
	For                         *string                                 `json:"for,omitempty"`
	KeepFiringFor               *string                                 `json:"keepFiringFor,omitempty"`
	MissingSeriesEvalsToResolve *int64                                  `json:"missingSeriesEvalsToResolve,omitempty"`
	NoDataState                 GetSearchRulesNoDataState               `json:"noDataState"`
	ExecErrState                GetSearchRulesExecErrState              `json:"execErrState"`
	NotificationSettings        *GetSearchRulesNotificationSettings     `json:"notificationSettings,omitempty"`
	Expressions                 GetSearchRulesExpressionMap             `json:"expressions"`
	PanelRef                    *GetSearchRulesPanelRef                 `json:"panelRef,omitempty"`
}

// NewGetSearchRulesAlertRuleSpec creates a new GetSearchRulesAlertRuleSpec object.
func NewGetSearchRulesAlertRuleSpec() *GetSearchRulesAlertRuleSpec {
	return &GetSearchRulesAlertRuleSpec{
		Trigger:      *NewGetSearchRulesIntervalTrigger(),
		NoDataState:  GetSearchRulesNoDataStateNoData,
		ExecErrState: GetSearchRulesExecErrStateError,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesAlertRuleSpec.
func (GetSearchRulesAlertRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesAlertRuleSpec"
}

// +k8s:openapi-gen=true
type GetSearchRulesIntervalTrigger struct {
	Interval GetSearchRulesPromDuration `json:"interval"`
}

// NewGetSearchRulesIntervalTrigger creates a new GetSearchRulesIntervalTrigger object.
func NewGetSearchRulesIntervalTrigger() *GetSearchRulesIntervalTrigger {
	return &GetSearchRulesIntervalTrigger{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesIntervalTrigger.
func (GetSearchRulesIntervalTrigger) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesIntervalTrigger"
}

// +k8s:openapi-gen=true
type GetSearchRulesPromDuration string

// +k8s:openapi-gen=true
type GetSearchRulesTemplateString string

// +k8s:openapi-gen=true
type GetSearchRulesNoDataState string

const (
	GetSearchRulesNoDataStateNoData   GetSearchRulesNoDataState = "NoData"
	GetSearchRulesNoDataStateOk       GetSearchRulesNoDataState = "Ok"
	GetSearchRulesNoDataStateAlerting GetSearchRulesNoDataState = "Alerting"
	GetSearchRulesNoDataStateKeepLast GetSearchRulesNoDataState = "KeepLast"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesNoDataState.
func (GetSearchRulesNoDataState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesNoDataState"
}

// +k8s:openapi-gen=true
type GetSearchRulesExecErrState string

const (
	GetSearchRulesExecErrStateError    GetSearchRulesExecErrState = "Error"
	GetSearchRulesExecErrStateOk       GetSearchRulesExecErrState = "Ok"
	GetSearchRulesExecErrStateAlerting GetSearchRulesExecErrState = "Alerting"
	GetSearchRulesExecErrStateKeepLast GetSearchRulesExecErrState = "KeepLast"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesExecErrState.
func (GetSearchRulesExecErrState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesExecErrState"
}

// +k8s:openapi-gen=true
type GetSearchRulesNotificationSettings = GetSearchRulesSimplifiedRoutingOrNamedRoutingTree

// NewGetSearchRulesNotificationSettings creates a new GetSearchRulesNotificationSettings object.
func NewGetSearchRulesNotificationSettings() *GetSearchRulesNotificationSettings {
	return NewGetSearchRulesSimplifiedRoutingOrNamedRoutingTree()
}

// +k8s:openapi-gen=true
type GetSearchRulesSimplifiedRouting struct {
	Type                GetSearchRulesNotificationSettingsType `json:"type"`
	Receiver            string                                 `json:"receiver"`
	GroupBy             []string                               `json:"groupBy,omitempty"`
	GroupWait           *GetSearchRulesPromDuration            `json:"groupWait,omitempty"`
	GroupInterval       *GetSearchRulesPromDuration            `json:"groupInterval,omitempty"`
	RepeatInterval      *GetSearchRulesPromDuration            `json:"repeatInterval,omitempty"`
	MuteTimeIntervals   []GetSearchRulesTimeIntervalRef        `json:"muteTimeIntervals,omitempty"`
	ActiveTimeIntervals []GetSearchRulesTimeIntervalRef        `json:"activeTimeIntervals,omitempty"`
}

// NewGetSearchRulesSimplifiedRouting creates a new GetSearchRulesSimplifiedRouting object.
func NewGetSearchRulesSimplifiedRouting() *GetSearchRulesSimplifiedRouting {
	return &GetSearchRulesSimplifiedRouting{
		Type: GetSearchRulesNotificationSettingsTypeSimplifiedRouting,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesSimplifiedRouting.
func (GetSearchRulesSimplifiedRouting) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesSimplifiedRouting"
}

// +k8s:openapi-gen=true
type GetSearchRulesNotificationSettingsType string

const (
	GetSearchRulesNotificationSettingsTypeSimplifiedRouting GetSearchRulesNotificationSettingsType = "SimplifiedRouting"
	GetSearchRulesNotificationSettingsTypeNamedRoutingTree  GetSearchRulesNotificationSettingsType = "NamedRoutingTree"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesNotificationSettingsType.
func (GetSearchRulesNotificationSettingsType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesNotificationSettingsType"
}

// +k8s:openapi-gen=true
type GetSearchRulesTimeIntervalRef string

// +k8s:openapi-gen=true
type GetSearchRulesNamedRoutingTree struct {
	Type        GetSearchRulesNotificationSettingsType `json:"type"`
	RoutingTree string                                 `json:"routingTree"`
}

// NewGetSearchRulesNamedRoutingTree creates a new GetSearchRulesNamedRoutingTree object.
func NewGetSearchRulesNamedRoutingTree() *GetSearchRulesNamedRoutingTree {
	return &GetSearchRulesNamedRoutingTree{
		Type: GetSearchRulesNotificationSettingsTypeNamedRoutingTree,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesNamedRoutingTree.
func (GetSearchRulesNamedRoutingTree) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesNamedRoutingTree"
}

// +k8s:openapi-gen=true
type GetSearchRulesExpressionMap map[string]GetSearchRulesExpression

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesExpressionMap.
func (GetSearchRulesExpressionMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesExpressionMap"
}

// +k8s:openapi-gen=true
type GetSearchRulesExpression struct {
	QueryType         *string                          `json:"queryType,omitempty"`
	RelativeTimeRange *GetSearchRulesRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	DatasourceUID     *GetSearchRulesDatasourceUID     `json:"datasourceUID,omitempty"`
	Model             interface{}                      `json:"model"`
	Source            *bool                            `json:"source,omitempty"`
}

// NewGetSearchRulesExpression creates a new GetSearchRulesExpression object.
func NewGetSearchRulesExpression() *GetSearchRulesExpression {
	return &GetSearchRulesExpression{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesExpression.
func (GetSearchRulesExpression) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesExpression"
}

// +k8s:openapi-gen=true
type GetSearchRulesRelativeTimeRange struct {
	From GetSearchRulesPromDurationWMillis `json:"from"`
	To   GetSearchRulesPromDurationWMillis `json:"to"`
}

// NewGetSearchRulesRelativeTimeRange creates a new GetSearchRulesRelativeTimeRange object.
func NewGetSearchRulesRelativeTimeRange() *GetSearchRulesRelativeTimeRange {
	return &GetSearchRulesRelativeTimeRange{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRelativeTimeRange.
func (GetSearchRulesRelativeTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRelativeTimeRange"
}

// +k8s:openapi-gen=true
type GetSearchRulesPromDurationWMillis string

// +k8s:openapi-gen=true
type GetSearchRulesDatasourceUID string

// +k8s:openapi-gen=true
type GetSearchRulesPanelRef struct {
	DashboardUID string `json:"dashboardUID"`
	PanelID      int64  `json:"panelID"`
}

// NewGetSearchRulesPanelRef creates a new GetSearchRulesPanelRef object.
func NewGetSearchRulesPanelRef() *GetSearchRulesPanelRef {
	return &GetSearchRulesPanelRef{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesPanelRef.
func (GetSearchRulesPanelRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesPanelRef"
}

// +k8s:openapi-gen=true
type GetSearchRulesRecordingRuleSpec struct {
	Title               string                                  `json:"title"`
	Paused              *bool                                   `json:"paused,omitempty"`
	Trigger             GetSearchRulesIntervalTrigger           `json:"trigger"`
	Labels              map[string]GetSearchRulesTemplateString `json:"labels,omitempty"`
	Metric              GetSearchRulesMetricName                `json:"metric"`
	Expressions         GetSearchRulesExpressionMap             `json:"expressions"`
	TargetDatasourceUID GetSearchRulesDatasourceUID             `json:"targetDatasourceUID"`
}

// NewGetSearchRulesRecordingRuleSpec creates a new GetSearchRulesRecordingRuleSpec object.
func NewGetSearchRulesRecordingRuleSpec() *GetSearchRulesRecordingRuleSpec {
	return &GetSearchRulesRecordingRuleSpec{
		Trigger: *NewGetSearchRulesIntervalTrigger(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRecordingRuleSpec.
func (GetSearchRulesRecordingRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRecordingRuleSpec"
}

// +k8s:openapi-gen=true
type GetSearchRulesMetricName string

// +k8s:openapi-gen=true
type GetSearchRulesBody struct {
	Items []GetSearchRulesRuleHit `json:"items"`
}

// NewGetSearchRulesBody creates a new GetSearchRulesBody object.
func NewGetSearchRulesBody() *GetSearchRulesBody {
	return &GetSearchRulesBody{
		Items: []GetSearchRulesRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesBody.
func (GetSearchRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesBody"
}

// +k8s:openapi-gen=true
type GetSearchRulesSimplifiedRoutingOrNamedRoutingTree struct {
	SimplifiedRouting *GetSearchRulesSimplifiedRouting `json:"SimplifiedRouting,omitempty"`
	NamedRoutingTree  *GetSearchRulesNamedRoutingTree  `json:"NamedRoutingTree,omitempty"`
}

// NewGetSearchRulesSimplifiedRoutingOrNamedRoutingTree creates a new GetSearchRulesSimplifiedRoutingOrNamedRoutingTree object.
func NewGetSearchRulesSimplifiedRoutingOrNamedRoutingTree() *GetSearchRulesSimplifiedRoutingOrNamedRoutingTree {
	return &GetSearchRulesSimplifiedRoutingOrNamedRoutingTree{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `GetSearchRulesSimplifiedRoutingOrNamedRoutingTree` as JSON.
func (resource GetSearchRulesSimplifiedRoutingOrNamedRoutingTree) MarshalJSON() ([]byte, error) {
	if resource.SimplifiedRouting != nil {
		return json.Marshal(resource.SimplifiedRouting)
	}
	if resource.NamedRoutingTree != nil {
		return json.Marshal(resource.NamedRoutingTree)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `GetSearchRulesSimplifiedRoutingOrNamedRoutingTree` from JSON.
func (resource *GetSearchRulesSimplifiedRoutingOrNamedRoutingTree) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["type"]
	if !found {
		return nil
	}

	switch discriminator {
	case "NamedRoutingTree":
		var getSearchRulesNamedRoutingTree GetSearchRulesNamedRoutingTree
		if err := json.Unmarshal(raw, &getSearchRulesNamedRoutingTree); err != nil {
			return err
		}

		resource.NamedRoutingTree = &getSearchRulesNamedRoutingTree
		return nil
	case "SimplifiedRouting":
		var getSearchRulesSimplifiedRouting GetSearchRulesSimplifiedRouting
		if err := json.Unmarshal(raw, &getSearchRulesSimplifiedRouting); err != nil {
			return err
		}

		resource.SimplifiedRouting = &getSearchRulesSimplifiedRouting
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesSimplifiedRoutingOrNamedRoutingTree.
func (GetSearchRulesSimplifiedRoutingOrNamedRoutingTree) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesSimplifiedRoutingOrNamedRoutingTree"
}
