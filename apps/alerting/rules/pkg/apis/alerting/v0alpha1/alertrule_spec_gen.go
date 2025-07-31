// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// TODO: validate that only one can specify source=true
// & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per
// +k8s:openapi-gen=true
type AlertRuleQueryMap map[string]AlertRuleQuery

// TODO: come up with a better name for this. We have expression type things and data source queries
// +k8s:openapi-gen=true
type AlertRuleQuery struct {
	// TODO: consider making this optional, with the nil value meaning "__expr__" (i.e. expression query)
	QueryType         string                      `json:"queryType"`
	RelativeTimeRange *AlertRuleRelativeTimeRange `json:"relativeTimeRange,omitempty"`
	DatasourceUID     AlertRuleDatasourceUID      `json:"datasourceUID"`
	Model             interface{}                 `json:"model"`
	Source            *bool                       `json:"source,omitempty"`
}

// NewAlertRuleQuery creates a new AlertRuleQuery object.
func NewAlertRuleQuery() *AlertRuleQuery {
	return &AlertRuleQuery{}
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
type AlertRuleIntervalTrigger struct {
	Interval AlertRulePromDuration `json:"interval"`
}

// NewAlertRuleIntervalTrigger creates a new AlertRuleIntervalTrigger object.
func NewAlertRuleIntervalTrigger() *AlertRuleIntervalTrigger {
	return &AlertRuleIntervalTrigger{}
}

// +k8s:openapi-gen=true
type AlertRulePromDuration string

// TODO(@moustafab): validate regex for time interval ref
// +k8s:openapi-gen=true
type AlertRuleTimeIntervalRef string

// +k8s:openapi-gen=true
type AlertRuleTemplateString string

// +k8s:openapi-gen=true
type AlertRuleSpec struct {
	Title                       string                                     `json:"title"`
	Data                        AlertRuleQueryMap                          `json:"data"`
	Paused                      *bool                                      `json:"paused,omitempty"`
	Trigger                     AlertRuleIntervalTrigger                   `json:"trigger"`
	NoDataState                 string                                     `json:"noDataState"`
	ExecErrState                string                                     `json:"execErrState"`
	For                         *string                                    `json:"for,omitempty"`
	KeepFiringFor               *string                                    `json:"keepFiringFor,omitempty"`
	MissingSeriesEvalsToResolve *int64                                     `json:"missingSeriesEvalsToResolve,omitempty"`
	NotificationSettings        *AlertRuleV0alpha1SpecNotificationSettings `json:"notificationSettings,omitempty"`
	Annotations                 map[string]AlertRuleTemplateString         `json:"annotations,omitempty"`
	Labels                      map[string]AlertRuleTemplateString         `json:"labels,omitempty"`
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
