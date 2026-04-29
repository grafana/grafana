// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
)

// +k8s:openapi-gen=true
type AlertRuleIntervalTrigger struct {
	Interval AlertRulePromDuration `json:"interval"`
}

// NewAlertRuleIntervalTrigger creates a new AlertRuleIntervalTrigger object.
func NewAlertRuleIntervalTrigger() *AlertRuleIntervalTrigger {
	return &AlertRuleIntervalTrigger{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleIntervalTrigger.
func (AlertRuleIntervalTrigger) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleIntervalTrigger"
}

// +k8s:openapi-gen=true
type AlertRulePromDuration string

// +k8s:openapi-gen=true
type AlertRuleTemplateString string

// +k8s:openapi-gen=true
type AlertRuleNoDataState string

const (
	AlertRuleNoDataStateNoData   AlertRuleNoDataState = "NoData"
	AlertRuleNoDataStateOk       AlertRuleNoDataState = "Ok"
	AlertRuleNoDataStateAlerting AlertRuleNoDataState = "Alerting"
	AlertRuleNoDataStateKeepLast AlertRuleNoDataState = "KeepLast"
)

// OpenAPIModelName returns the OpenAPI model name for AlertRuleNoDataState.
func (AlertRuleNoDataState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleNoDataState"
}

// +k8s:openapi-gen=true
type AlertRuleExecErrState string

const (
	AlertRuleExecErrStateError    AlertRuleExecErrState = "Error"
	AlertRuleExecErrStateOk       AlertRuleExecErrState = "Ok"
	AlertRuleExecErrStateAlerting AlertRuleExecErrState = "Alerting"
	AlertRuleExecErrStateKeepLast AlertRuleExecErrState = "KeepLast"
)

// OpenAPIModelName returns the OpenAPI model name for AlertRuleExecErrState.
func (AlertRuleExecErrState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleExecErrState"
}

// TODO(@moustafab): this should be imported from the notifications package
// +k8s:openapi-gen=true
type AlertRuleNotificationSettings = AlertRuleSimplifiedRoutingOrNamedRoutingTree

// NewAlertRuleNotificationSettings creates a new AlertRuleNotificationSettings object.
func NewAlertRuleNotificationSettings() *AlertRuleNotificationSettings {
	return NewAlertRuleSimplifiedRoutingOrNamedRoutingTree()
}

// +k8s:openapi-gen=true
type AlertRuleSimplifiedRouting struct {
	Type                AlertRuleNotificationSettingsType `json:"type"`
	Receiver            string                            `json:"receiver"`
	GroupBy             []string                          `json:"groupBy,omitempty"`
	GroupWait           *AlertRulePromDuration            `json:"groupWait,omitempty"`
	GroupInterval       *AlertRulePromDuration            `json:"groupInterval,omitempty"`
	RepeatInterval      *AlertRulePromDuration            `json:"repeatInterval,omitempty"`
	MuteTimeIntervals   []AlertRuleTimeIntervalRef        `json:"muteTimeIntervals,omitempty"`
	ActiveTimeIntervals []AlertRuleTimeIntervalRef        `json:"activeTimeIntervals,omitempty"`
}

// NewAlertRuleSimplifiedRouting creates a new AlertRuleSimplifiedRouting object.
func NewAlertRuleSimplifiedRouting() *AlertRuleSimplifiedRouting {
	return &AlertRuleSimplifiedRouting{
		Type: AlertRuleNotificationSettingsTypeSimplifiedRouting,
	}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleSimplifiedRouting.
func (AlertRuleSimplifiedRouting) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleSimplifiedRouting"
}

// +k8s:openapi-gen=true
type AlertRuleNotificationSettingsType string

const (
	AlertRuleNotificationSettingsTypeSimplifiedRouting AlertRuleNotificationSettingsType = "SimplifiedRouting"
	AlertRuleNotificationSettingsTypeNamedRoutingTree  AlertRuleNotificationSettingsType = "NamedRoutingTree"
)

// OpenAPIModelName returns the OpenAPI model name for AlertRuleNotificationSettingsType.
func (AlertRuleNotificationSettingsType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleNotificationSettingsType"
}

// TODO(@moustafab): validate regex for time interval ref
// +k8s:openapi-gen=true
type AlertRuleTimeIntervalRef string

// +k8s:openapi-gen=true
type AlertRuleNamedRoutingTree struct {
	Type        AlertRuleNotificationSettingsType `json:"type"`
	RoutingTree string                            `json:"routingTree"`
}

// NewAlertRuleNamedRoutingTree creates a new AlertRuleNamedRoutingTree object.
func NewAlertRuleNamedRoutingTree() *AlertRuleNamedRoutingTree {
	return &AlertRuleNamedRoutingTree{
		Type: AlertRuleNotificationSettingsTypeNamedRoutingTree,
	}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleNamedRoutingTree.
func (AlertRuleNamedRoutingTree) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleNamedRoutingTree"
}

// TODO: validate that only one can specify source=true
// & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per
// +k8s:openapi-gen=true
type AlertRuleExpressionMap map[string]AlertRuleExpression

// OpenAPIModelName returns the OpenAPI model name for AlertRuleExpressionMap.
func (AlertRuleExpressionMap) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleExpressionMap"
}

// +k8s:openapi-gen=true
type AlertRuleExpression struct {
	// The type of query if this is a query expression
	QueryType         *string                     `json:"queryType,omitempty"`
	RelativeTimeRange *AlertRuleRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	// The UID of the datasource to run this expression against. If omitted, the expression will be run against the `__expr__` datasource
	DatasourceUID *AlertRuleDatasourceUID `json:"datasourceUID,omitempty"`
	Model         interface{}             `json:"model"`
	// Used to mark the expression to be used as the final source for the rule evaluation
	// Only one expression in a rule can be marked as the source
	// For AlertRules, this is the expression that will be evaluated against the alerting condition
	// For RecordingRules, this is the expression that will be recorded
	Source *bool `json:"source,omitempty"`
}

// NewAlertRuleExpression creates a new AlertRuleExpression object.
func NewAlertRuleExpression() *AlertRuleExpression {
	return &AlertRuleExpression{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleExpression.
func (AlertRuleExpression) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleExpression"
}

// +k8s:openapi-gen=true
type AlertRuleRelativeTimeRange struct {
	From AlertRulePromDurationWMillis `json:"from"`
	To   AlertRulePromDurationWMillis `json:"to"`
}

// NewAlertRuleRelativeTimeRange creates a new AlertRuleRelativeTimeRange object.
func NewAlertRuleRelativeTimeRange() *AlertRuleRelativeTimeRange {
	return &AlertRuleRelativeTimeRange{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleRelativeTimeRange.
func (AlertRuleRelativeTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleRelativeTimeRange"
}

// +k8s:openapi-gen=true
type AlertRulePromDurationWMillis string

// +k8s:openapi-gen=true
type AlertRuleDatasourceUID string

// +k8s:openapi-gen=true
type AlertRulePanelRef struct {
	DashboardUID string `json:"dashboardUID"`
	PanelID      int64  `json:"panelID"`
}

// NewAlertRulePanelRef creates a new AlertRulePanelRef object.
func NewAlertRulePanelRef() *AlertRulePanelRef {
	return &AlertRulePanelRef{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRulePanelRef.
func (AlertRulePanelRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRulePanelRef"
}

// +k8s:openapi-gen=true
type AlertRuleSpec struct {
	Title                       string                             `json:"title"`
	Paused                      *bool                              `json:"paused,omitempty"`
	Trigger                     AlertRuleIntervalTrigger           `json:"trigger"`
	Labels                      map[string]AlertRuleTemplateString `json:"labels,omitempty"`
	Annotations                 map[string]AlertRuleTemplateString `json:"annotations,omitempty"`
	For                         *string                            `json:"for,omitempty"`
	KeepFiringFor               *string                            `json:"keepFiringFor,omitempty"`
	MissingSeriesEvalsToResolve *int64                             `json:"missingSeriesEvalsToResolve,omitempty"`
	NoDataState                 AlertRuleNoDataState               `json:"noDataState"`
	ExecErrState                AlertRuleExecErrState              `json:"execErrState"`
	NotificationSettings        *AlertRuleNotificationSettings     `json:"notificationSettings,omitempty"`
	Expressions                 AlertRuleExpressionMap             `json:"expressions"`
	PanelRef                    *AlertRulePanelRef                 `json:"panelRef,omitempty"`
}

// NewAlertRuleSpec creates a new AlertRuleSpec object.
func NewAlertRuleSpec() *AlertRuleSpec {
	return &AlertRuleSpec{
		Trigger:      *NewAlertRuleIntervalTrigger(),
		NoDataState:  AlertRuleNoDataStateNoData,
		ExecErrState: AlertRuleExecErrStateError,
	}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleSpec.
func (AlertRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleSpec"
}

// +k8s:openapi-gen=true
type AlertRuleSimplifiedRoutingOrNamedRoutingTree struct {
	SimplifiedRouting *AlertRuleSimplifiedRouting `json:"SimplifiedRouting,omitempty"`
	NamedRoutingTree  *AlertRuleNamedRoutingTree  `json:"NamedRoutingTree,omitempty"`
}

// NewAlertRuleSimplifiedRoutingOrNamedRoutingTree creates a new AlertRuleSimplifiedRoutingOrNamedRoutingTree object.
func NewAlertRuleSimplifiedRoutingOrNamedRoutingTree() *AlertRuleSimplifiedRoutingOrNamedRoutingTree {
	return &AlertRuleSimplifiedRoutingOrNamedRoutingTree{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `AlertRuleSimplifiedRoutingOrNamedRoutingTree` as JSON.
func (resource AlertRuleSimplifiedRoutingOrNamedRoutingTree) MarshalJSON() ([]byte, error) {
	if resource.SimplifiedRouting != nil {
		return json.Marshal(resource.SimplifiedRouting)
	}
	if resource.NamedRoutingTree != nil {
		return json.Marshal(resource.NamedRoutingTree)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `AlertRuleSimplifiedRoutingOrNamedRoutingTree` from JSON.
func (resource *AlertRuleSimplifiedRoutingOrNamedRoutingTree) UnmarshalJSON(raw []byte) error {
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
		discriminator = "SimplifiedRouting"
	}

	switch discriminator {
	case "NamedRoutingTree":
		var alertRuleNamedRoutingTree AlertRuleNamedRoutingTree
		if err := json.Unmarshal(raw, &alertRuleNamedRoutingTree); err != nil {
			return err
		}

		resource.NamedRoutingTree = &alertRuleNamedRoutingTree
		return nil
	case "SimplifiedRouting":
		var alertRuleSimplifiedRouting AlertRuleSimplifiedRouting
		if err := json.Unmarshal(raw, &alertRuleSimplifiedRouting); err != nil {
			return err
		}

		resource.SimplifiedRouting = &alertRuleSimplifiedRouting
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleSimplifiedRoutingOrNamedRoutingTree.
func (AlertRuleSimplifiedRoutingOrNamedRoutingTree) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleSimplifiedRoutingOrNamedRoutingTree"
}
