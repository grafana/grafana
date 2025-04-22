package models

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unsafe"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	prommodels "github.com/prometheus/common/model"

	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

var (
	// ErrAlertRuleNotFound is an error for an unknown alert rule.
	ErrAlertRuleNotFound = fmt.Errorf("could not find alert rule")
	// ErrAlertRuleFailedGenerateUniqueUID is an error for failure to generate alert rule UID
	ErrAlertRuleFailedGenerateUniqueUID = errors.New("failed to generate alert rule UID")
	// ErrCannotEditNamespace is an error returned if the user does not have permissions to edit the namespace
	ErrCannotEditNamespace        = errors.New("user does not have permissions to edit the namespace")
	ErrRuleGroupNamespaceNotFound = errors.New("rule group not found under this namespace")
	ErrAlertRuleFailedValidation  = errors.New("invalid alert rule")
	ErrQuotaReached               = errors.New("quota has been exceeded")
	// ErrNoDashboard is returned when the alert rule does not have a Dashboard UID
	// in its annotations or the dashboard does not exist.
	ErrNoDashboard = errors.New("no dashboard")

	// ErrNoPanel is returned when the alert rule does not have a PanelID in its
	// annotations.
	ErrNoPanel = errors.New("no panel")
)

var (
	FileProvisioningUserUID = UserUID("__provisioning__")
	AlertingUserUID         = UserUID("__alerting__")
)

// swagger:enum NoDataState
type NoDataState string

func (noDataState NoDataState) String() string {
	return string(noDataState)
}

func NoDataStateFromString(state string) (NoDataState, error) {
	switch state {
	case string(Alerting):
		return Alerting, nil
	case string(NoData):
		return NoData, nil
	case string(OK):
		return OK, nil
	case string(KeepLast):
		return KeepLast, nil
	default:
		return "", fmt.Errorf("unknown NoData state option %s", state)
	}
}

const (
	Alerting NoDataState = "Alerting"
	NoData   NoDataState = "NoData"
	OK       NoDataState = "OK"
	KeepLast NoDataState = "KeepLast"
)

// swagger:enum ExecutionErrorState
type ExecutionErrorState string

func (executionErrorState ExecutionErrorState) String() string {
	return string(executionErrorState)
}

func ErrStateFromString(opt string) (ExecutionErrorState, error) {
	switch opt {
	case string(Alerting):
		return AlertingErrState, nil
	case string(ErrorErrState):
		return ErrorErrState, nil
	case string(OkErrState):
		return OkErrState, nil
	case string(KeepLastErrState):
		return KeepLastErrState, nil
	default:
		return "", fmt.Errorf("unknown Error state option %s", opt)
	}
}

const (
	AlertingErrState ExecutionErrorState = "Alerting"
	ErrorErrState    ExecutionErrorState = "Error"
	OkErrState       ExecutionErrorState = "OK"
	KeepLastErrState ExecutionErrorState = "KeepLast"
)

type RuleType string

const (
	RuleTypeAlerting  RuleType = "alerting"
	RuleTypeRecording RuleType = "recording"
)

func (r RuleType) String() string {
	return string(r)
}

const (
	// Annotations are actually a set of labels, so technically this is the label name of an annotation.
	DashboardUIDAnnotation = "__dashboardUid__"
	PanelIDAnnotation      = "__panelId__"

	// GrafanaReservedLabelPrefix contains the prefix for Grafana reserved labels. These differ from "__<label>__" labels
	// in that they are not meant for internal-use only and will be passed-through to AMs and available to users in the same
	// way as manually configured labels.
	GrafanaReservedLabelPrefix = "grafana_"

	// FolderTitleLabel is the label that will contain the title of an alert's folder/namespace.
	FolderTitleLabel = GrafanaReservedLabelPrefix + "folder"

	// StateReasonAnnotation is the name of the annotation that explains the difference between evaluation state and alert state (i.e. changing state when NoData or Error).
	StateReasonAnnotation = GrafanaReservedLabelPrefix + "state_reason"

	// MigratedLabelPrefix is a label prefix for all labels created during legacy migration.
	MigratedLabelPrefix = "__legacy_"
	// MigratedUseLegacyChannelsLabel is created during legacy migration to route to separate nested policies for migrated channels.
	MigratedUseLegacyChannelsLabel = MigratedLabelPrefix + "use_channels__"
	// MigratedContactLabelPrefix is created during legacy migration to route a migrated alert rule to a specific migrated channel.
	MigratedContactLabelPrefix = MigratedLabelPrefix + "c_"
	// MigratedSilenceLabelErrorKeepState is a label that will match a silence rule intended for legacy alerts with error state = keep_state.
	MigratedSilenceLabelErrorKeepState = MigratedLabelPrefix + "silence_error_keep_state__"
	// MigratedSilenceLabelNodataKeepState is a label that will match a silence rule intended for legacy alerts with nodata state = keep_state.
	MigratedSilenceLabelNodataKeepState = MigratedLabelPrefix + "silence_nodata_keep_state__"
	// MigratedAlertIdAnnotation is created during legacy migration to store the ID of the migrated legacy alert rule.
	MigratedAlertIdAnnotation = "__alertId__"
	// MigratedMessageAnnotation is created during legacy migration to store the migrated alert message.
	MigratedMessageAnnotation = "message"

	// AutogeneratedRouteLabel a label name used to distinguish alerts that are supposed to be handled by the autogenerated policy. Only expected value is `true`.
	AutogeneratedRouteLabel = "__grafana_autogenerated__"
	// AutogeneratedRouteReceiverNameLabel a label name that contains the name of the receiver that should be used to send notifications for the alert.
	AutogeneratedRouteReceiverNameLabel = "__grafana_receiver__"
	// AutogeneratedRouteSettingsHashLabel a label name that contains the hash of the notification settings that will be used to send notifications for the alert.
	// This should uniquely identify the notification settings (group_by, group_wait, group_interval, repeat_interval, mute_time_intervals) for the alert.
	AutogeneratedRouteSettingsHashLabel = "__grafana_route_settings_hash__"
)

const (
	StateReasonMissingSeries = "MissingSeries"
	StateReasonNoData        = "NoData"
	StateReasonError         = "Error"
	StateReasonPaused        = "Paused"
	StateReasonUpdated       = "Updated"
	StateReasonRuleDeleted   = "RuleDeleted"
	StateReasonKeepLast      = "KeepLast"
)

func ConcatReasons(reasons ...string) string {
	return strings.Join(reasons, ", ")
}

var (
	// InternalLabelNameSet are labels that grafana automatically include as part of the labelset.
	InternalLabelNameSet = map[string]struct{}{
		alertingModels.RuleUIDLabel:      {},
		alertingModels.NamespaceUIDLabel: {},
	}
	InternalAnnotationNameSet = map[string]struct{}{
		DashboardUIDAnnotation:              {},
		PanelIDAnnotation:                   {},
		alertingModels.ImageTokenAnnotation: {},
	}

	// LabelsUserCannotSpecify are labels that the user cannot specify when creating an alert rule.
	LabelsUserCannotSpecify = map[string]struct{}{
		AutogeneratedRouteLabel:             {},
		AutogeneratedRouteReceiverNameLabel: {},
		AutogeneratedRouteSettingsHashLabel: {},
	}
)

// AlertRuleGroup is the base model for a rule group in unified alerting.
type AlertRuleGroup struct {
	Title      string
	FolderUID  string
	Interval   int64
	Provenance Provenance
	Rules      []AlertRule
}

// AlertRuleGroupWithFolderFullpath extends AlertRuleGroup with orgID and folder title
type AlertRuleGroupWithFolderFullpath struct {
	*AlertRuleGroup
	OrgID          int64
	FolderFullpath string
}

func NewAlertRuleGroupWithFolderFullpath(groupKey AlertRuleGroupKey, rules []AlertRule, folderFullpath string) AlertRuleGroupWithFolderFullpath {
	SortAlertRulesByGroupIndex(rules)
	var interval int64
	if len(rules) > 0 {
		interval = rules[0].IntervalSeconds
	}
	var result = AlertRuleGroupWithFolderFullpath{
		AlertRuleGroup: &AlertRuleGroup{
			Title:     groupKey.RuleGroup,
			FolderUID: groupKey.NamespaceUID,
			Interval:  interval,
			Rules:     rules,
		},
		FolderFullpath: folderFullpath,
		OrgID:          groupKey.OrgID,
	}
	return result
}

func NewAlertRuleGroupWithFolderFullpathFromRulesGroup(groupKey AlertRuleGroupKey, rules RulesGroup, folderFullpath string) AlertRuleGroupWithFolderFullpath {
	derefRules := make([]AlertRule, 0, len(rules))
	for _, rule := range rules {
		derefRules = append(derefRules, *rule)
	}
	return NewAlertRuleGroupWithFolderFullpath(groupKey, derefRules, folderFullpath)
}

// SortAlertRuleGroupWithFolderTitle sorts AlertRuleGroupWithFolderTitle by folder UID and group name
func SortAlertRuleGroupWithFolderTitle(g []AlertRuleGroupWithFolderFullpath) {
	sort.SliceStable(g, func(i, j int) bool {
		if g[i].FolderUID == g[j].FolderUID {
			return g[i].Title < g[j].Title
		}
		return g[i].FolderUID < g[j].FolderUID
	})
}

type UserUID string

func NewUserUID(requester interface{ GetIdentifier() string }) *UserUID {
	// use anonymous interface to abstract from identity package, which is part of apimachinery
	if requester == nil {
		return nil
	}
	identifier := requester.GetIdentifier()
	if identifier == "" {
		return nil
	}
	userUID := UserUID(identifier)
	return &userUID
}

// AlertRule is the model for alert rules in unified alerting.
type AlertRule struct {
	ID int64
	// Uniquely identifies alert rule across all organizations and time
	GUID            string
	OrgID           int64
	Title           string
	Condition       string
	Data            []AlertQuery
	Updated         time.Time
	UpdatedBy       *UserUID
	IntervalSeconds int64
	Version         int64
	UID             string
	NamespaceUID    string
	DashboardUID    *string
	PanelID         *int64
	RuleGroup       string
	RuleGroupIndex  int
	Record          *Record
	NoDataState     NoDataState
	ExecErrState    ExecutionErrorState
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For                  time.Duration
	KeepFiringFor        time.Duration
	Annotations          map[string]string
	Labels               map[string]string
	IsPaused             bool
	NotificationSettings []NotificationSettings
	Metadata             AlertRuleMetadata
	// MissingSeriesEvalsToResolve specifies the number of consecutive evaluation intervals
	// required before resolving an alert state (a dimension) when data is missing.
	// If nil, alerts resolve after 2 missing evaluation intervals
	// (i.e., resolution occurs during the second evaluation where data is absent).
	MissingSeriesEvalsToResolve *int
}

type AlertRuleMetadata struct {
	EditorSettings      EditorSettings       `json:"editor_settings"`
	PrometheusStyleRule *PrometheusStyleRule `json:"prometheus_style_rule,omitempty"`
}

type EditorSettings struct {
	SimplifiedQueryAndExpressionsSection bool `json:"simplified_query_and_expressions_section"`
	SimplifiedNotificationsSection       bool `json:"simplified_notifications_section"`
}

type PrometheusStyleRule struct {
	OriginalRuleDefinition string `json:"original_rule_definition,omitempty"`
}

// Namespaced describes a class of resources that are stored in a specific namespace.
type Namespaced interface {
	GetNamespaceUID() string
}

type Namespace folder.FolderReference

func (n Namespace) GetNamespaceUID() string {
	return n.UID
}

// AlertRuleWithOptionals This is to avoid having to pass in additional arguments deep in the call stack. Alert rule
// object is created in an early validation step without knowledge about current alert rule fields or if they need to be
// overridden. This is done in a later step and, in that step, we did not have knowledge about if a field was optional
// nor its possible value.
type AlertRuleWithOptionals struct {
	AlertRule
	// This parameter is to know if an optional API field was sent and, therefore, patch it with the current field from
	// DB in case it was not sent.
	HasPause          bool
	HasEditorSettings bool
}

// AlertsRulesBy is a function that defines the ordering of alert rules.
type AlertRulesBy func(a1, a2 *AlertRule) bool

func (by AlertRulesBy) Sort(rules []*AlertRule) {
	sort.Sort(AlertRulesSorter{rules: rules, by: by})
}

// AlertRulesByIndex orders alert rules by rule group index. You should
// make sure that all alert rules belong to the same rule group (have the
// same RuleGroupKey) before using this ordering.
func AlertRulesByIndex(a1, a2 *AlertRule) bool {
	return a1.RuleGroupIndex < a2.RuleGroupIndex
}

func AlertRulesByGroupKeyAndIndex(a1, a2 *AlertRule) bool {
	k1, k2 := a1.GetGroupKey(), a2.GetGroupKey()
	if k1 == k2 {
		return a1.RuleGroupIndex < a2.RuleGroupIndex
	}
	return AlertRuleGroupKeyByNamespaceAndRuleGroup(&k1, &k2)
}

type AlertRulesSorter struct {
	rules []*AlertRule
	by    AlertRulesBy
}

func (s AlertRulesSorter) Len() int           { return len(s.rules) }
func (s AlertRulesSorter) Swap(i, j int)      { s.rules[i], s.rules[j] = s.rules[j], s.rules[i] }
func (s AlertRulesSorter) Less(i, j int) bool { return s.by(s.rules[i], s.rules[j]) }

func (alertRule *AlertRule) GetNamespaceUID() string {
	return alertRule.NamespaceUID
}

// GetDashboardUID returns the DashboardUID or "".
func (alertRule *AlertRule) GetDashboardUID() string {
	if alertRule.DashboardUID != nil {
		return *alertRule.DashboardUID
	}
	return ""
}

// GetPanelID returns the Panel ID or -1.
func (alertRule *AlertRule) GetPanelID() int64 {
	if alertRule.PanelID != nil {
		return *alertRule.PanelID
	}
	return -1
}

type LabelOption func(map[string]string)

func WithoutInternalLabels() LabelOption {
	return func(labels map[string]string) {
		for k := range labels {
			if _, ok := InternalLabelNameSet[k]; ok {
				delete(labels, k)
			}
		}
	}
}

func (alertRule *AlertRule) ImportedFromPrometheus() bool {
	_, err := alertRule.PrometheusRuleDefinition()
	return err == nil
}

func (alertRule *AlertRule) PrometheusRuleDefinition() (string, error) {
	if alertRule.Metadata.PrometheusStyleRule != nil {
		if alertRule.Metadata.PrometheusStyleRule.OriginalRuleDefinition != "" {
			return alertRule.Metadata.PrometheusStyleRule.OriginalRuleDefinition, nil
		}
	}

	return "", fmt.Errorf("prometheus rule definition is missing")
}

// GetLabels returns the labels specified as part of the alert rule.
func (alertRule *AlertRule) GetLabels(opts ...LabelOption) map[string]string {
	labels := alertRule.Labels

	for _, opt := range opts {
		opt(labels)
	}

	return labels
}

func (alertRule *AlertRule) GetEvalCondition() Condition {
	meta := map[string]string{
		"Name":    alertRule.Title,
		"Uid":     alertRule.UID,
		"Type":    string(alertRule.Type()),
		"Version": strconv.FormatInt(alertRule.Version, 10),
	}
	if alertRule.Type() == RuleTypeRecording {
		return Condition{
			Metadata:  meta,
			Condition: alertRule.Record.From,
			Data:      alertRule.Data,
		}
	}
	return Condition{
		Metadata:  meta,
		Condition: alertRule.Condition,
		Data:      alertRule.Data,
	}
}

// Diff calculates diff between two alert rules. Returns nil if two rules are equal. Otherwise, returns cmputil.DiffReport
func (alertRule *AlertRule) Diff(rule *AlertRule, ignore ...string) cmputil.DiffReport {
	var reporter cmputil.DiffReporter
	ops := make([]cmp.Option, 0, 6)

	// json.RawMessage is a slice of bytes and therefore cmp's default behavior is to compare it by byte, which is not really useful
	var jsonCmp = cmp.Transformer("", func(in json.RawMessage) string {
		b, err := json.Marshal(in)
		if err != nil {
			return string(in)
		}
		return string(b)
	})
	ops = append(
		ops,
		cmp.Reporter(&reporter),
		cmpopts.IgnoreFields(AlertQuery{}, "modelProps"),
		jsonCmp,
		cmpopts.EquateEmpty(),
	)

	if len(ignore) > 0 {
		ops = append(ops, cmpopts.IgnoreFields(AlertRule{}, ignore...))
	}
	cmp.Equal(alertRule, rule, ops...)
	return reporter.Diffs
}

// SetDashboardAndPanelFromAnnotations will set the DashboardUID and PanelID field by doing a lookup in the annotations.
// Errors when the found annotations are not valid.
func (alertRule *AlertRule) SetDashboardAndPanelFromAnnotations() error {
	if alertRule.Annotations == nil {
		return nil
	}
	dashUID := alertRule.Annotations[DashboardUIDAnnotation]
	panelID := alertRule.Annotations[PanelIDAnnotation]
	if dashUID != "" && panelID == "" || dashUID == "" && panelID != "" {
		return fmt.Errorf("%w: both annotations %s and %s must be specified", ErrAlertRuleFailedValidation,
			DashboardUIDAnnotation, PanelIDAnnotation)
	}
	if dashUID != "" {
		panelIDValue, err := strconv.ParseInt(panelID, 10, 64)
		if err != nil {
			return fmt.Errorf("%w: annotation %s must be a valid integer Panel ID", ErrAlertRuleFailedValidation,
				PanelIDAnnotation)
		}
		alertRule.DashboardUID = &dashUID
		alertRule.PanelID = &panelIDValue
	}
	return nil
}

// AlertRuleKey is the alert definition identifier
type AlertRuleKey struct {
	OrgID int64  `xorm:"org_id"`
	UID   string `xorm:"uid"`
}

func (k AlertRuleKey) LogContext() []any {
	return []any{"rule_uid", k.UID, "org_id", k.OrgID}
}

type AlertRuleKeyWithVersion struct {
	Version      int64
	AlertRuleKey `xorm:"extends"`
}

type AlertRuleKeyWithGroup struct {
	RuleGroup    string
	AlertRuleKey `xorm:"extends"`
}

type AlertRuleKeyWithId struct {
	AlertRuleKey
	ID int64
}

// AlertRuleGroupKey is the identifier of a group of alerts
type AlertRuleGroupKey struct {
	OrgID        int64
	NamespaceUID string
	RuleGroup    string
}

type AlertRuleGroupKeyWithFolderFullpath struct {
	AlertRuleGroupKey
	FolderFullpath string
}

func (k AlertRuleGroupKey) String() string {
	return fmt.Sprintf("{orgID: %d, namespaceUID: %s, groupName: %s}", k.OrgID, k.NamespaceUID, k.RuleGroup)
}

func (k AlertRuleKey) String() string {
	return fmt.Sprintf("{orgID: %d, UID: %s}", k.OrgID, k.UID)
}

// AlertRuleGroupKeyBy is a function that defines the ordering of alert rule group keys.
type AlertRuleGroupKeyBy func(a1, a2 *AlertRuleGroupKey) bool

func (by AlertRuleGroupKeyBy) Sort(keys []AlertRuleGroupKey) {
	sort.Sort(AlertRuleGroupKeySorter{keys: keys, by: by})
}

func AlertRuleGroupKeyByNamespaceAndRuleGroup(k1, k2 *AlertRuleGroupKey) bool {
	if k1.NamespaceUID == k2.NamespaceUID {
		return k1.RuleGroup < k2.RuleGroup
	}
	return k1.NamespaceUID < k2.NamespaceUID
}

type AlertRuleGroupKeySorter struct {
	keys []AlertRuleGroupKey
	by   AlertRuleGroupKeyBy
}

func (s AlertRuleGroupKeySorter) Len() int           { return len(s.keys) }
func (s AlertRuleGroupKeySorter) Swap(i, j int)      { s.keys[i], s.keys[j] = s.keys[j], s.keys[i] }
func (s AlertRuleGroupKeySorter) Less(i, j int) bool { return s.by(&s.keys[i], &s.keys[j]) }

// GetKey returns the alert definitions identifier
func (alertRule *AlertRule) GetKey() AlertRuleKey {
	return AlertRuleKey{OrgID: alertRule.OrgID, UID: alertRule.UID}
}

// GetKeyWithGroup returns the alert definitions identifier
func (alertRule *AlertRule) GetKeyWithGroup() AlertRuleKeyWithGroup {
	return AlertRuleKeyWithGroup{AlertRuleKey: alertRule.GetKey(), RuleGroup: alertRule.RuleGroup}
}

// GetGroupKey returns the identifier of a group the rule belongs to
func (alertRule *AlertRule) GetGroupKey() AlertRuleGroupKey {
	return AlertRuleGroupKey{OrgID: alertRule.OrgID, NamespaceUID: alertRule.NamespaceUID, RuleGroup: alertRule.RuleGroup}
}

// GetMissingSeriesEvalsToResolve returns the number of consecutive evaluation intervals
// to wait before resolving an alert rule instance when its data is missing.
// If not configured, it returns the default value (2), which means the alert
// resolves after missing for two evaluation intervals.
func (alertRule *AlertRule) GetMissingSeriesEvalsToResolve() int {
	if alertRule.MissingSeriesEvalsToResolve == nil {
		return 2 // default value
	}

	return *alertRule.MissingSeriesEvalsToResolve
}

// PreSave sets default values and loads the updated model for each alert query.
func (alertRule *AlertRule) PreSave(timeNow func() time.Time, userUID *UserUID) error {
	for i, q := range alertRule.Data {
		err := q.PreSave()
		if err != nil {
			return fmt.Errorf("invalid alert query %s: %w", q.RefID, err)
		}
		alertRule.Data[i] = q
	}
	alertRule.Updated = timeNow()
	alertRule.UpdatedBy = userUID
	return nil
}

// ValidateAlertRule validates various alert rule fields.
func (alertRule *AlertRule) ValidateAlertRule(cfg setting.UnifiedAlertingSettings) error {
	if err := util.ValidateUID(alertRule.UID); err != nil {
		return errors.Join(ErrAlertRuleFailedValidation, fmt.Errorf("cannot create rule with UID '%s': %w", alertRule.UID, err))
	}
	if len(alertRule.Data) == 0 {
		return fmt.Errorf("%w: no queries or expressions are found", ErrAlertRuleFailedValidation)
	}

	if alertRule.Title == "" {
		return fmt.Errorf("%w: title is empty", ErrAlertRuleFailedValidation)
	}

	if err := ValidateRuleGroupInterval(alertRule.IntervalSeconds, int64(cfg.BaseInterval.Seconds())); err != nil {
		return err
	}

	if alertRule.OrgID == 0 {
		return fmt.Errorf("%w: no organisation is found", ErrAlertRuleFailedValidation)
	}

	if alertRule.DashboardUID == nil && alertRule.PanelID != nil {
		return fmt.Errorf("%w: cannot have Panel ID without a Dashboard UID", ErrAlertRuleFailedValidation)
	}

	var err error
	if alertRule.Type() == RuleTypeRecording {
		err = validateRecordingRuleFields(alertRule)
	} else {
		err = validateAlertRuleFields(alertRule)
	}
	if err != nil {
		return fmt.Errorf("%w: %s", ErrAlertRuleFailedValidation, err)
	}

	if alertRule.For < 0 {
		return fmt.Errorf("%w: field `for` cannot be negative", ErrAlertRuleFailedValidation)
	}

	if alertRule.KeepFiringFor < 0 {
		return fmt.Errorf("%w: field `keep_firing_for` cannot be negative", ErrAlertRuleFailedValidation)
	}

	if len(alertRule.Labels) > 0 {
		for label := range alertRule.Labels {
			if _, ok := LabelsUserCannotSpecify[label]; ok {
				return fmt.Errorf("%w: system reserved label %s cannot be defined", ErrAlertRuleFailedValidation, label)
			}
		}
	}

	if len(alertRule.NotificationSettings) > 0 {
		if len(alertRule.NotificationSettings) != 1 {
			return fmt.Errorf("%w: only one notification settings entry is allowed", ErrAlertRuleFailedValidation)
		}
		if err := alertRule.NotificationSettings[0].Validate(); err != nil {
			return errors.Join(ErrAlertRuleFailedValidation, fmt.Errorf("invalid notification settings: %w", err))
		}
	}
	return nil
}

func validateAlertRuleFields(rule *AlertRule) error {
	if _, err := ErrStateFromString(string(rule.ExecErrState)); err != nil {
		return err
	}

	if _, err := NoDataStateFromString(string(rule.NoDataState)); err != nil {
		return err
	}

	if rule.MissingSeriesEvalsToResolve != nil && *rule.MissingSeriesEvalsToResolve <= 0 {
		return errors.New("field `missing_series_evals_to_resolve` must be greater than 0")
	}

	return nil
}

func validateRecordingRuleFields(rule *AlertRule) error {
	metricName := prommodels.LabelValue(rule.Record.Metric)
	if !metricName.IsValid() {
		return errors.New("metric name for recording rule must be a valid utf8 string")
	}
	if !prommodels.IsValidMetricName(metricName) {
		return errors.New("metric name for recording rule must be a valid Prometheus metric name")
	}

	ClearRecordingRuleIgnoredFields(rule)

	return nil
}

func (alertRule *AlertRule) ResourceType() string {
	return "alertRule"
}

func (alertRule *AlertRule) ResourceID() string {
	return alertRule.UID
}

func (alertRule *AlertRule) ResourceOrgID() int64 {
	return alertRule.OrgID
}

func (alertRule *AlertRule) GetFolderKey() FolderKey {
	return FolderKey{
		OrgID: alertRule.OrgID,
		UID:   alertRule.NamespaceUID,
	}
}

func (alertRule *AlertRule) Type() RuleType {
	if alertRule.Record != nil {
		return RuleTypeRecording
	}
	return RuleTypeAlerting
}

// Copy creates and returns a deep copy of the AlertRule instance, duplicating all fields and nested data structures.
func (alertRule *AlertRule) Copy() *AlertRule {
	if alertRule == nil {
		return nil
	}
	result := AlertRule{
		ID:                          alertRule.ID,
		GUID:                        alertRule.GUID,
		OrgID:                       alertRule.OrgID,
		Title:                       alertRule.Title,
		Condition:                   alertRule.Condition,
		Updated:                     alertRule.Updated,
		UpdatedBy:                   alertRule.UpdatedBy,
		IntervalSeconds:             alertRule.IntervalSeconds,
		Version:                     alertRule.Version,
		UID:                         alertRule.UID,
		NamespaceUID:                alertRule.NamespaceUID,
		RuleGroup:                   alertRule.RuleGroup,
		RuleGroupIndex:              alertRule.RuleGroupIndex,
		NoDataState:                 alertRule.NoDataState,
		ExecErrState:                alertRule.ExecErrState,
		For:                         alertRule.For,
		Record:                      alertRule.Record,
		IsPaused:                    alertRule.IsPaused,
		Metadata:                    alertRule.Metadata,
		KeepFiringFor:               alertRule.KeepFiringFor,
		MissingSeriesEvalsToResolve: alertRule.MissingSeriesEvalsToResolve,
	}

	if alertRule.DashboardUID != nil {
		dash := *alertRule.DashboardUID
		result.DashboardUID = &dash
	}
	if alertRule.PanelID != nil {
		p := *alertRule.PanelID
		result.PanelID = &p
	}

	for _, d := range alertRule.Data {
		q := AlertQuery{
			RefID:             d.RefID,
			QueryType:         d.QueryType,
			RelativeTimeRange: d.RelativeTimeRange,
			DatasourceUID:     d.DatasourceUID,
		}
		q.Model = make([]byte, 0, cap(d.Model))
		q.Model = append(q.Model, d.Model...)
		result.Data = append(result.Data, q)
	}

	if alertRule.Annotations != nil {
		result.Annotations = make(map[string]string, len(alertRule.Annotations))
		for s, s2 := range alertRule.Annotations {
			result.Annotations[s] = s2
		}
	}

	if alertRule.Labels != nil {
		result.Labels = make(map[string]string, len(alertRule.Labels))
		for s, s2 := range alertRule.Labels {
			result.Labels[s] = s2
		}
	}

	if alertRule.Record != nil {
		result.Record = &Record{
			From:   alertRule.Record.From,
			Metric: alertRule.Record.Metric,
		}
	}

	if alertRule.Metadata.PrometheusStyleRule != nil {
		prometheusStyleRule := *alertRule.Metadata.PrometheusStyleRule
		result.Metadata.PrometheusStyleRule = &prometheusStyleRule
	}

	for _, s := range alertRule.NotificationSettings {
		result.NotificationSettings = append(result.NotificationSettings, CopyNotificationSettings(s))
	}

	return &result
}

func ClearRecordingRuleIgnoredFields(rule *AlertRule) {
	rule.NoDataState = ""
	rule.ExecErrState = ""
	rule.Condition = ""
	rule.For = 0
	rule.KeepFiringFor = 0
	rule.NotificationSettings = nil
	rule.MissingSeriesEvalsToResolve = nil
}

// GetAlertRuleByUIDQuery is the query for retrieving/deleting an alert rule by UID and organisation ID.
type GetAlertRuleByUIDQuery struct {
	UID   string
	OrgID int64
}

// GetAlertRuleByIDQuery is the query for retrieving/deleting an alert rule by ID and organisation ID.
type GetAlertRuleByIDQuery struct {
	ID    int64
	OrgID int64
}

// GetAlertRulesGroupByRuleUIDQuery is the query for retrieving a group of alerts by UID of a rule that belongs to that group
type GetAlertRulesGroupByRuleUIDQuery struct {
	UID   string
	OrgID int64
}

// ListAlertRulesQuery is the query for listing alert rules
type ListAlertRulesQuery struct {
	OrgID         int64
	RuleUIDs      []string
	NamespaceUIDs []string
	ExcludeOrgs   []int64
	RuleGroups    []string

	// DashboardUID and PanelID are optional and allow filtering rules
	// to return just those for a dashboard and panel.
	DashboardUID string
	PanelID      int64

	ReceiverName     string
	TimeIntervalName string

	ImportedPrometheusRule *bool
}

// CountAlertRulesQuery is the query for counting alert rules
type CountAlertRulesQuery struct {
	OrgID        int64
	NamespaceUID string
}

type FolderKey struct {
	OrgID int64
	UID   string
}

func (f FolderKey) String() string {
	return fmt.Sprintf("%d:%s", f.OrgID, f.UID)
}

type GetAlertRulesForSchedulingQuery struct {
	PopulateFolders bool
	RuleGroups      []string

	ResultRules []*AlertRule
	// A map of folder UID to folder Title in NamespaceKey format (see GetNamespaceKey)
	ResultFoldersTitles map[FolderKey]string
}

// ListNamespaceAlertRulesQuery is the query for listing namespace alert rules
type ListNamespaceAlertRulesQuery struct {
	OrgID int64
	// Namespace is the folder slug
	NamespaceUID string
}

type UpdateRule struct {
	Existing *AlertRule
	New      AlertRule
}

// Condition contains backend expressions and queries and the RefID
// of the query or expression that will be evaluated.
type Condition struct {
	// Additional information provided to the evaluation to include to the request as headers in format `X-Rule-{Key}`
	Metadata map[string]string
	// Condition is the RefID of the query or expression from
	// the Data property to get the results for.
	Condition string `json:"condition"`

	// Data is an array of data source queries and/or server side expressions.
	Data []AlertQuery `json:"data"`
}

func (c Condition) withMetadata(key, value string) Condition {
	meta := make(map[string]string, len(c.Metadata)+1)
	maps.Copy(meta, c.Metadata)
	meta[key] = value
	return Condition{
		Metadata:  meta,
		Condition: c.Condition,
		Data:      c.Data,
	}
}

func (c Condition) WithFolder(folderTitle string) Condition {
	return c.withMetadata("Folder", folderTitle)
}

func (c Condition) WithSource(source string) Condition {
	return c.withMetadata("Source", source)
}

// IsValid checks the condition's validity.
func (c Condition) IsValid() bool {
	// TODO search for refIDs in QueriesAndExpressions
	return len(c.Data) != 0
}

// PatchPartialAlertRule patches `ruleToPatch` by `existingRule` following the rule that if a field of `ruleToPatch` is empty or has the default value, it is populated by the value of the corresponding field from `existingRule`.
// There are several exceptions:
//  1. Following fields are not patched and therefore will be ignored: AlertRule.ID, AlertRule.OrgID, AlertRule.Updated, AlertRule.Version,
//     AlertRule.UID, AlertRule.DashboardUID, AlertRule.PanelID, AlertRule.Annotations, AlertRule.Labels, AlertRule.Metadata (except for EditorSettings)
//  2. There are fields that are patched together:
//     - AlertRule.Condition and AlertRule.Data
//
// If either of the pair is specified, neither is patched.
func PatchPartialAlertRule(existingRule *AlertRule, ruleToPatch *AlertRuleWithOptionals) {
	if ruleToPatch.Title == "" {
		ruleToPatch.Title = existingRule.Title
	}
	if !hasAnyCondition(ruleToPatch) || len(ruleToPatch.Data) == 0 {
		ruleToPatch.Condition = existingRule.Condition
		ruleToPatch.Data = existingRule.Data
	}
	if ruleToPatch.IntervalSeconds == 0 {
		ruleToPatch.IntervalSeconds = existingRule.IntervalSeconds
	}
	if ruleToPatch.NamespaceUID == "" {
		ruleToPatch.NamespaceUID = existingRule.NamespaceUID
	}
	if ruleToPatch.RuleGroup == "" {
		ruleToPatch.RuleGroup = existingRule.RuleGroup
	}
	if ruleToPatch.ExecErrState == "" {
		ruleToPatch.ExecErrState = existingRule.ExecErrState
	}
	if ruleToPatch.NoDataState == "" {
		ruleToPatch.NoDataState = existingRule.NoDataState
	}
	if ruleToPatch.For == -1 {
		ruleToPatch.For = existingRule.For
	}
	if ruleToPatch.KeepFiringFor == -1 {
		ruleToPatch.KeepFiringFor = existingRule.KeepFiringFor
	}
	if !ruleToPatch.HasPause {
		ruleToPatch.IsPaused = existingRule.IsPaused
	}
	if !ruleToPatch.HasEditorSettings {
		ruleToPatch.Metadata.EditorSettings = existingRule.Metadata.EditorSettings
	}
	if ruleToPatch.MissingSeriesEvalsToResolve != nil && *ruleToPatch.MissingSeriesEvalsToResolve == -1 {
		ruleToPatch.MissingSeriesEvalsToResolve = existingRule.MissingSeriesEvalsToResolve
	}

	if ruleToPatch.GUID == "" {
		ruleToPatch.GUID = existingRule.GUID
	}
}

func ValidateRuleGroupInterval(intervalSeconds, baseIntervalSeconds int64) error {
	if intervalSeconds%baseIntervalSeconds != 0 || intervalSeconds <= 0 {
		return fmt.Errorf("%w: interval (%v) should be non-zero and divided exactly by scheduler interval: %v",
			ErrAlertRuleFailedValidation, time.Duration(intervalSeconds)*time.Second, baseIntervalSeconds)
	}
	return nil
}

type RulesGroup []*AlertRule

func RulesGroupComparer(a, b *AlertRule) int {
	if a.RuleGroupIndex < b.RuleGroupIndex {
		return -1
	} else if a.RuleGroupIndex > b.RuleGroupIndex {
		return 1
	}
	if a.ID < b.ID {
		return -1
	} else if a.ID > b.ID {
		return 1
	}
	return 0
}

func (g RulesGroup) SortByGroupIndex() {
	slices.SortFunc(g, RulesGroupComparer)
}

func SortAlertRulesByGroupIndex(rules []AlertRule) {
	sort.Slice(rules, func(i, j int) bool {
		if rules[i].RuleGroupIndex == rules[j].RuleGroupIndex {
			return rules[i].ID < rules[j].ID
		}
		return rules[i].RuleGroupIndex < rules[j].RuleGroupIndex
	})
}

const (
	QuotaTargetSrv quota.TargetSrv = "ngalert"
	QuotaTarget    quota.Target    = "alert_rule"
)

type ruleKeyContextKey struct{}

func WithRuleKey(ctx context.Context, ruleKey AlertRuleKey) context.Context {
	return context.WithValue(ctx, ruleKeyContextKey{}, ruleKey)
}

func RuleKeyFromContext(ctx context.Context) (AlertRuleKey, bool) {
	key, ok := ctx.Value(ruleKeyContextKey{}).(AlertRuleKey)
	return key, ok
}

// GroupByAlertRuleGroupKey groups all rules by AlertRuleGroupKey. Returns map of RulesGroup sorted by AlertRule.RuleGroupIndex
func GroupByAlertRuleGroupKey(rules []*AlertRule) map[AlertRuleGroupKey]RulesGroup {
	result := make(map[AlertRuleGroupKey]RulesGroup)
	for _, rule := range rules {
		result[rule.GetGroupKey()] = append(result[rule.GetGroupKey()], rule)
	}
	for _, group := range result {
		group.SortByGroupIndex()
	}
	return result
}

// Record contains mapping information for Recording Rules.
type Record struct {
	// Metric indicates a metric name to send results to.
	Metric string
	// From contains a query RefID, indicating which expression node is the output of the recording rule.
	From string
	// TargetDatasourceUID is the data source to write the result of the recording rule.
	TargetDatasourceUID string
}

func (r *Record) Fingerprint() data.Fingerprint {
	h := fnv.New64()

	writeString := func(s string) {
		// save on extra slice allocation when string is converted to bytes.
		_, _ = h.Write(unsafe.Slice(unsafe.StringData(s), len(s))) //nolint:gosec
		// ignore errors returned by Write method because fnv never returns them.
		_, _ = h.Write([]byte{255}) // use an invalid utf-8 sequence as separator
	}

	writeString(r.Metric)
	writeString(r.From)
	writeString(r.TargetDatasourceUID)
	return data.Fingerprint(h.Sum64())
}

func hasAnyCondition(rule *AlertRuleWithOptionals) bool {
	return rule.Condition != "" || (rule.Record != nil && rule.Record.From != "")
}

// RuleStatus contains info about a rule's current evaluation state.
type RuleStatus struct {
	Health              string
	LastError           error
	EvaluationTimestamp time.Time
	EvaluationDuration  time.Duration
}
