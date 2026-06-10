// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
)

// +k8s:openapi-gen=true
type GetSearchAlertRulesAlertRuleHit struct {
	Metadata interface{}                      `json:"metadata"`
	Spec     GetSearchAlertRulesAlertRuleSpec `json:"spec"`
}

// NewGetSearchAlertRulesAlertRuleHit creates a new GetSearchAlertRulesAlertRuleHit object.
func NewGetSearchAlertRulesAlertRuleHit() *GetSearchAlertRulesAlertRuleHit {
	return &GetSearchAlertRulesAlertRuleHit{
		Spec: *NewGetSearchAlertRulesAlertRuleSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesAlertRuleHit.
func (GetSearchAlertRulesAlertRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesAlertRuleHit"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesAlertRuleSpec struct {
	Title                       string                                       `json:"title"`
	Paused                      *bool                                        `json:"paused,omitempty"`
	Trigger                     GetSearchAlertRulesIntervalTrigger           `json:"trigger"`
	Labels                      map[string]GetSearchAlertRulesTemplateString `json:"labels,omitempty"`
	Annotations                 map[string]GetSearchAlertRulesTemplateString `json:"annotations,omitempty"`
	For                         *string                                      `json:"for,omitempty"`
	KeepFiringFor               *string                                      `json:"keepFiringFor,omitempty"`
	MissingSeriesEvalsToResolve *int64                                       `json:"missingSeriesEvalsToResolve,omitempty"`
	NoDataState                 GetSearchAlertRulesNoDataState               `json:"noDataState"`
	ExecErrState                GetSearchAlertRulesExecErrState              `json:"execErrState"`
	NotificationSettings        *GetSearchAlertRulesNotificationSettings     `json:"notificationSettings,omitempty"`
	Expressions                 GetSearchAlertRulesExpressionMap             `json:"expressions"`
	PanelRef                    *GetSearchAlertRulesPanelRef                 `json:"panelRef,omitempty"`
}

// NewGetSearchAlertRulesAlertRuleSpec creates a new GetSearchAlertRulesAlertRuleSpec object.
func NewGetSearchAlertRulesAlertRuleSpec() *GetSearchAlertRulesAlertRuleSpec {
	return &GetSearchAlertRulesAlertRuleSpec{
		Trigger:      *NewGetSearchAlertRulesIntervalTrigger(),
		NoDataState:  GetSearchAlertRulesNoDataStateNoData,
		ExecErrState: GetSearchAlertRulesExecErrStateError,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesAlertRuleSpec.
func (GetSearchAlertRulesAlertRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesAlertRuleSpec"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesIntervalTrigger struct {
	Interval GetSearchAlertRulesPromDuration `json:"interval"`
}

// NewGetSearchAlertRulesIntervalTrigger creates a new GetSearchAlertRulesIntervalTrigger object.
func NewGetSearchAlertRulesIntervalTrigger() *GetSearchAlertRulesIntervalTrigger {
	return &GetSearchAlertRulesIntervalTrigger{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesIntervalTrigger.
func (GetSearchAlertRulesIntervalTrigger) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesIntervalTrigger"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesPromDuration string

// +k8s:openapi-gen=true
type GetSearchAlertRulesTemplateString string

// +k8s:openapi-gen=true
type GetSearchAlertRulesNoDataState string

const (
	GetSearchAlertRulesNoDataStateNoData   GetSearchAlertRulesNoDataState = "NoData"
	GetSearchAlertRulesNoDataStateOk       GetSearchAlertRulesNoDataState = "Ok"
	GetSearchAlertRulesNoDataStateAlerting GetSearchAlertRulesNoDataState = "Alerting"
	GetSearchAlertRulesNoDataStateKeepLast GetSearchAlertRulesNoDataState = "KeepLast"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesNoDataState.
func (GetSearchAlertRulesNoDataState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesNoDataState"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesExecErrState string

const (
	GetSearchAlertRulesExecErrStateError    GetSearchAlertRulesExecErrState = "Error"
	GetSearchAlertRulesExecErrStateOk       GetSearchAlertRulesExecErrState = "Ok"
	GetSearchAlertRulesExecErrStateAlerting GetSearchAlertRulesExecErrState = "Alerting"
	GetSearchAlertRulesExecErrStateKeepLast GetSearchAlertRulesExecErrState = "KeepLast"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesExecErrState.
func (GetSearchAlertRulesExecErrState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesExecErrState"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesNotificationSettings = GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree

// NewGetSearchAlertRulesNotificationSettings creates a new GetSearchAlertRulesNotificationSettings object.
func NewGetSearchAlertRulesNotificationSettings() *GetSearchAlertRulesNotificationSettings {
	return NewGetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree()
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesSimplifiedRouting struct {
	Type                GetSearchAlertRulesNotificationSettingsType `json:"type"`
	Receiver            string                                      `json:"receiver"`
	GroupBy             []string                                    `json:"groupBy,omitempty"`
	GroupWait           *GetSearchAlertRulesPromDuration            `json:"groupWait,omitempty"`
	GroupInterval       *GetSearchAlertRulesPromDuration            `json:"groupInterval,omitempty"`
	RepeatInterval      *GetSearchAlertRulesPromDuration            `json:"repeatInterval,omitempty"`
	MuteTimeIntervals   []GetSearchAlertRulesTimeIntervalRef        `json:"muteTimeIntervals,omitempty"`
	ActiveTimeIntervals []GetSearchAlertRulesTimeIntervalRef        `json:"activeTimeIntervals,omitempty"`
}

// NewGetSearchAlertRulesSimplifiedRouting creates a new GetSearchAlertRulesSimplifiedRouting object.
func NewGetSearchAlertRulesSimplifiedRouting() *GetSearchAlertRulesSimplifiedRouting {
	return &GetSearchAlertRulesSimplifiedRouting{
		Type: GetSearchAlertRulesNotificationSettingsTypeSimplifiedRouting,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesSimplifiedRouting.
func (GetSearchAlertRulesSimplifiedRouting) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesSimplifiedRouting"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesNotificationSettingsType string

const (
	GetSearchAlertRulesNotificationSettingsTypeSimplifiedRouting GetSearchAlertRulesNotificationSettingsType = "SimplifiedRouting"
	GetSearchAlertRulesNotificationSettingsTypeNamedRoutingTree  GetSearchAlertRulesNotificationSettingsType = "NamedRoutingTree"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesNotificationSettingsType.
func (GetSearchAlertRulesNotificationSettingsType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesNotificationSettingsType"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesTimeIntervalRef string

// +k8s:openapi-gen=true
type GetSearchAlertRulesNamedRoutingTree struct {
	Type        GetSearchAlertRulesNotificationSettingsType `json:"type"`
	RoutingTree string                                      `json:"routingTree"`
}

// NewGetSearchAlertRulesNamedRoutingTree creates a new GetSearchAlertRulesNamedRoutingTree object.
func NewGetSearchAlertRulesNamedRoutingTree() *GetSearchAlertRulesNamedRoutingTree {
	return &GetSearchAlertRulesNamedRoutingTree{
		Type: GetSearchAlertRulesNotificationSettingsTypeNamedRoutingTree,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesNamedRoutingTree.
func (GetSearchAlertRulesNamedRoutingTree) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesNamedRoutingTree"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesExpressionMap map[string]GetSearchAlertRulesExpression

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesExpressionMap.
func (GetSearchAlertRulesExpressionMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesExpressionMap"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesExpression struct {
	QueryType         *string                               `json:"queryType,omitempty"`
	RelativeTimeRange *GetSearchAlertRulesRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	DatasourceUID     *GetSearchAlertRulesDatasourceUID     `json:"datasourceUID,omitempty"`
	Model             interface{}                           `json:"model"`
	Source            *bool                                 `json:"source,omitempty"`
}

// NewGetSearchAlertRulesExpression creates a new GetSearchAlertRulesExpression object.
func NewGetSearchAlertRulesExpression() *GetSearchAlertRulesExpression {
	return &GetSearchAlertRulesExpression{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesExpression.
func (GetSearchAlertRulesExpression) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesExpression"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesRelativeTimeRange struct {
	From GetSearchAlertRulesPromDurationWMillis `json:"from"`
	To   GetSearchAlertRulesPromDurationWMillis `json:"to"`
}

// NewGetSearchAlertRulesRelativeTimeRange creates a new GetSearchAlertRulesRelativeTimeRange object.
func NewGetSearchAlertRulesRelativeTimeRange() *GetSearchAlertRulesRelativeTimeRange {
	return &GetSearchAlertRulesRelativeTimeRange{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesRelativeTimeRange.
func (GetSearchAlertRulesRelativeTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesRelativeTimeRange"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesPromDurationWMillis string

// +k8s:openapi-gen=true
type GetSearchAlertRulesDatasourceUID string

// +k8s:openapi-gen=true
type GetSearchAlertRulesPanelRef struct {
	DashboardUID string `json:"dashboardUID"`
	PanelID      int64  `json:"panelID"`
}

// NewGetSearchAlertRulesPanelRef creates a new GetSearchAlertRulesPanelRef object.
func NewGetSearchAlertRulesPanelRef() *GetSearchAlertRulesPanelRef {
	return &GetSearchAlertRulesPanelRef{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesPanelRef.
func (GetSearchAlertRulesPanelRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesPanelRef"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesBody struct {
	Items []GetSearchAlertRulesAlertRuleHit `json:"items"`
}

// NewGetSearchAlertRulesBody creates a new GetSearchAlertRulesBody object.
func NewGetSearchAlertRulesBody() *GetSearchAlertRulesBody {
	return &GetSearchAlertRulesBody{
		Items: []GetSearchAlertRulesAlertRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesBody.
func (GetSearchAlertRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesBody"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree struct {
	SimplifiedRouting *GetSearchAlertRulesSimplifiedRouting `json:"SimplifiedRouting,omitempty"`
	NamedRoutingTree  *GetSearchAlertRulesNamedRoutingTree  `json:"NamedRoutingTree,omitempty"`
}

// NewGetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree creates a new GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree object.
func NewGetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree() *GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree {
	return &GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree` as JSON.
func (resource GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree) MarshalJSON() ([]byte, error) {
	if resource.SimplifiedRouting != nil {
		return json.Marshal(resource.SimplifiedRouting)
	}
	if resource.NamedRoutingTree != nil {
		return json.Marshal(resource.NamedRoutingTree)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree` from JSON.
func (resource *GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree) UnmarshalJSON(raw []byte) error {
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
		var getSearchAlertRulesNamedRoutingTree GetSearchAlertRulesNamedRoutingTree
		if err := json.Unmarshal(raw, &getSearchAlertRulesNamedRoutingTree); err != nil {
			return err
		}

		resource.NamedRoutingTree = &getSearchAlertRulesNamedRoutingTree
		return nil
	case "SimplifiedRouting":
		var getSearchAlertRulesSimplifiedRouting GetSearchAlertRulesSimplifiedRouting
		if err := json.Unmarshal(raw, &getSearchAlertRulesSimplifiedRouting); err != nil {
			return err
		}

		resource.SimplifiedRouting = &getSearchAlertRulesSimplifiedRouting
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree.
func (GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesSimplifiedRoutingOrNamedRoutingTree"
}
