// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AlertRuleQuery struct {
	QueryType         string                     `json:"queryType"`
	RelativeTimeRange AlertRuleRelativeTimeRange `json:"relativeTimeRange"`
	DatasourceUID     AlertRuleDatasourceUID     `json:"datasourceUID"`
	Model             interface{}                `json:"model"`
	Source            *bool                      `json:"source,omitempty"`
}

// NewAlertRuleQuery creates a new AlertRuleQuery object.
func NewAlertRuleQuery() *AlertRuleQuery {
	return &AlertRuleQuery{
		RelativeTimeRange: *NewAlertRuleRelativeTimeRange(),
	}
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

// TODO(@moustafab): validate regex for datasource UID
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

// TODO(@moustafab): validate regex for mute time interval ref
// +k8s:openapi-gen=true
type AlertRuleMuteTimeIntervalRef string

// TODO(@moustafab): validate regex for active time interval ref
// +k8s:openapi-gen=true
type AlertRuleActiveTimeIntervalRef string

// =~ figure out the regex for the template string
// +k8s:openapi-gen=true
type AlertRuleTemplateString string

// +k8s:openapi-gen=true
type AlertRuleSpec struct {
	Title                       string                                     `json:"title"`
	Data                        map[string]AlertRuleQuery                  `json:"data"`
	Paused                      *bool                                      `json:"paused,omitempty"`
	Trigger                     AlertRuleIntervalTrigger                   `json:"trigger"`
	NoDataState                 string                                     `json:"noDataState"`
	ExecErrState                string                                     `json:"execErrState"`
	For                         string                                     `json:"for"`
	KeepFiringFor               string                                     `json:"keepFiringFor"`
	MissingSeriesEvalsToResolve *int64                                     `json:"missingSeriesEvalsToResolve,omitempty"`
	NotificationSettings        *AlertRuleV0alpha1SpecNotificationSettings `json:"notificationSettings,omitempty"`
	Annotations                 map[string]AlertRuleTemplateString         `json:"annotations"`
	Labels                      map[string]AlertRuleTemplateString         `json:"labels"`
	PanelRef                    *AlertRuleV0alpha1SpecPanelRef             `json:"panelRef,omitempty"`
}

// NewAlertRuleSpec creates a new AlertRuleSpec object.
func NewAlertRuleSpec() *AlertRuleSpec {
	return &AlertRuleSpec{
		Data:         map[string]AlertRuleQuery{},
		Trigger:      *NewAlertRuleIntervalTrigger(),
		NoDataState:  "NoData",
		ExecErrState: "Error",
		Annotations:  map[string]AlertRuleTemplateString{},
		Labels:       map[string]AlertRuleTemplateString{},
	}
}

// +k8s:openapi-gen=true
type AlertRuleV0alpha1SpecNotificationSettings struct {
	Receiver            string                           `json:"receiver"`
	GroupBy             []string                         `json:"groupBy,omitempty"`
	GroupWait           *string                          `json:"groupWait,omitempty"`
	GroupInterval       *string                          `json:"groupInterval,omitempty"`
	RepeatInterval      *string                          `json:"repeatInterval,omitempty"`
	MuteTimeIntervals   []AlertRuleMuteTimeIntervalRef   `json:"muteTimeIntervals,omitempty"`
	ActiveTimeIntervals []AlertRuleActiveTimeIntervalRef `json:"activeTimeIntervals,omitempty"`
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
