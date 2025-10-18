// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AlertRuleIntervalTrigger struct {
	Interval AlertRulePromDuration `json:"interval"`
}

// NewAlertRuleIntervalTrigger creates a new AlertRuleIntervalTrigger object.
func NewAlertRuleIntervalTrigger() *AlertRuleIntervalTrigger {
	return &AlertRuleIntervalTrigger{}
}

// +k8s:openapi-gen=true
type AlertRulePromDuration string

// +k8s:openapi-gen=true
type AlertRuleTemplateString string

// TODO(@moustafab): validate regex for time interval ref
// +k8s:openapi-gen=true
type AlertRuleTimeIntervalRef string

// TODO: validate that only one can specify source=true
// & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per
// +k8s:openapi-gen=true
type AlertRuleExpressionMap map[string]AlertRuleExpression

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

// +k8s:openapi-gen=true
type AlertRuleRelativeTimeRange struct {
	From AlertRulePromDurationWMillis `json:"from"`
	To   AlertRulePromDurationWMillis `json:"to"`
}

// NewAlertRuleRelativeTimeRange creates a new AlertRuleRelativeTimeRange object.
func NewAlertRuleRelativeTimeRange() *AlertRuleRelativeTimeRange {
	return &AlertRuleRelativeTimeRange{}
}

// +k8s:openapi-gen=true
type AlertRulePromDurationWMillis string

// +k8s:openapi-gen=true
type AlertRuleDatasourceUID string

// +k8s:openapi-gen=true
type AlertRuleSpec struct {
	Title                       string                                     `json:"title"`
	Paused                      *bool                                      `json:"paused,omitempty"`
	Trigger                     AlertRuleIntervalTrigger                   `json:"trigger"`
	Labels                      map[string]AlertRuleTemplateString         `json:"labels,omitempty"`
	Annotations                 map[string]AlertRuleTemplateString         `json:"annotations,omitempty"`
	For                         *string                                    `json:"for,omitempty"`
	KeepFiringFor               *string                                    `json:"keepFiringFor,omitempty"`
	MissingSeriesEvalsToResolve *int64                                     `json:"missingSeriesEvalsToResolve,omitempty"`
	NoDataState                 string                                     `json:"noDataState"`
	ExecErrState                string                                     `json:"execErrState"`
	NotificationSettings        *AlertRuleV0alpha1SpecNotificationSettings `json:"notificationSettings,omitempty"`
	Expressions                 AlertRuleExpressionMap                     `json:"expressions"`
	PanelRef                    *AlertRuleV0alpha1SpecPanelRef             `json:"panelRef,omitempty"`
}

// NewAlertRuleSpec creates a new AlertRuleSpec object.
func NewAlertRuleSpec() *AlertRuleSpec {
	return &AlertRuleSpec{
		Trigger:      *NewAlertRuleIntervalTrigger(),
		NoDataState:  "NoData",
		ExecErrState: "Error",
	}
}

// +k8s:openapi-gen=true
type AlertRuleV0alpha1SpecNotificationSettings struct {
	Receiver            string                     `json:"receiver"`
	GroupBy             []string                   `json:"groupBy,omitempty"`
	GroupWait           *AlertRulePromDuration     `json:"groupWait,omitempty"`
	GroupInterval       *AlertRulePromDuration     `json:"groupInterval,omitempty"`
	RepeatInterval      *AlertRulePromDuration     `json:"repeatInterval,omitempty"`
	MuteTimeIntervals   []AlertRuleTimeIntervalRef `json:"muteTimeIntervals,omitempty"`
	ActiveTimeIntervals []AlertRuleTimeIntervalRef `json:"activeTimeIntervals,omitempty"`
}

// NewAlertRuleV0alpha1SpecNotificationSettings creates a new AlertRuleV0alpha1SpecNotificationSettings object.
func NewAlertRuleV0alpha1SpecNotificationSettings() *AlertRuleV0alpha1SpecNotificationSettings {
	return &AlertRuleV0alpha1SpecNotificationSettings{}
}

// +k8s:openapi-gen=true
type AlertRuleV0alpha1SpecPanelRef struct {
	DashboardUID string `json:"dashboardUID"`
	PanelID      int64  `json:"panelID"`
}

// NewAlertRuleV0alpha1SpecPanelRef creates a new AlertRuleV0alpha1SpecPanelRef object.
func NewAlertRuleV0alpha1SpecPanelRef() *AlertRuleV0alpha1SpecPanelRef {
	return &AlertRuleV0alpha1SpecPanelRef{}
}
