package models

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

var (
	// ErrAlertRuleNotFound is an error for an unknown alert rule.
	ErrAlertRuleNotFound = fmt.Errorf("could not find alert rule")
	// ErrAlertRuleFailedGenerateUniqueUID is an error for failure to generate alert rule UID
	ErrAlertRuleFailedGenerateUniqueUID = errors.New("failed to generate alert rule UID")
	// ErrCannotEditNamespace is an error returned if the user does not have permissions to edit the namespace
	ErrCannotEditNamespace                = errors.New("user does not have permissions to edit the namespace")
	ErrRuleGroupNamespaceNotFound         = errors.New("rule group not found under this namespace")
	ErrAlertRuleFailedValidation          = errors.New("invalid alert rule")
	ErrAlertRuleUniqueConstraintViolation = errors.New("a conflicting alert rule is found: rule title under the same organisation and folder should be unique")
	ErrQuotaReached                       = errors.New("quota has been exceeded")
	// ErrNoDashboard is returned when the alert rule does not have a Dashboard UID
	// in its annotations or the dashboard does not exist.
	ErrNoDashboard = errors.New("no dashboard")

	// ErrNoPanel is returned when the alert rule does not have a PanelID in its
	// annotations.
	ErrNoPanel = errors.New("no panel")
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
	default:
		return "", fmt.Errorf("unknown NoData state option %s", state)
	}
}

const (
	Alerting NoDataState = "Alerting"
	NoData   NoDataState = "NoData"
	OK       NoDataState = "OK"
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
	default:
		return "", fmt.Errorf("unknown Error state option %s", opt)
	}
}

const (
	AlertingErrState ExecutionErrorState = "Alerting"
	ErrorErrState    ExecutionErrorState = "Error"
	OkErrState       ExecutionErrorState = "OK"
)

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
)

const (
	StateReasonMissingSeries = "MissingSeries"
	StateReasonError         = "Error"
	StateReasonPaused        = "Paused"
	StateReasonUpdated       = "Updated"
	StateReasonRuleDeleted   = "RuleDeleted"
)

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
)

// AlertRuleGroup is the base model for a rule group in unified alerting.
type AlertRuleGroup struct {
	Title      string
	FolderUID  string
	Interval   int64
	Provenance Provenance
	Rules      []AlertRule
}

// AlertRule is the model for alert rules in unified alerting.
type AlertRule struct {
	ID              int64 `xorm:"pk autoincr 'id'"`
	OrgID           int64 `xorm:"org_id"`
	Title           string
	Condition       string
	Data            []AlertQuery
	Updated         time.Time
	IntervalSeconds int64
	Version         int64   `xorm:"version"` // this tag makes xorm add optimistic lock (see https://xorm.io/docs/chapter-06/1.lock/)
	UID             string  `xorm:"uid"`
	NamespaceUID    string  `xorm:"namespace_uid"`
	DashboardUID    *string `xorm:"dashboard_uid"`
	PanelID         *int64  `xorm:"panel_id"`
	RuleGroup       string
	RuleGroupIndex  int `xorm:"rule_group_idx"`
	NoDataState     NoDataState
	ExecErrState    ExecutionErrorState
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For         time.Duration
	Annotations map[string]string
	Labels      map[string]string
	IsPaused    bool
}

// AlertRuleWithOptionals This is to avoid having to pass in additional arguments deep in the call stack. Alert rule
// object is created in an early validation step without knowledge about current alert rule fields or if they need to be
// overridden. This is done in a later step and, in that step, we did not have knowledge about if a field was optional
// nor its possible value.
type AlertRuleWithOptionals struct {
	AlertRule
	// This parameter is to know if an optional API field was sent and, therefore, patch it with the current field from
	// DB in case it was not sent.
	HasPause bool
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

// GetLabels returns the labels specified as part of the alert rule.
func (alertRule *AlertRule) GetLabels(opts ...LabelOption) map[string]string {
	labels := alertRule.Labels

	for _, opt := range opts {
		opt(labels)
	}

	return labels
}

func (alertRule *AlertRule) GetEvalCondition() Condition {
	return Condition{
		Condition: alertRule.Condition,
		Data:      alertRule.Data,
	}
}

// Diff calculates diff between two alert rules. Returns nil if two rules are equal. Otherwise, returns cmputil.DiffReport
func (alertRule *AlertRule) Diff(rule *AlertRule, ignore ...string) cmputil.DiffReport {
	var reporter cmputil.DiffReporter
	ops := make([]cmp.Option, 0, 5)

	// json.RawMessage is a slice of bytes and therefore cmp's default behavior is to compare it by byte, which is not really useful
	var jsonCmp = cmp.Transformer("", func(in json.RawMessage) string {
		return string(in)
	})
	ops = append(ops, cmp.Reporter(&reporter), cmpopts.IgnoreFields(AlertQuery{}, "modelProps"), jsonCmp, cmpopts.EquateEmpty())

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
		return fmt.Errorf("both annotations %s and %s must be specified",
			DashboardUIDAnnotation, PanelIDAnnotation)
	}
	if dashUID != "" {
		panelIDValue, err := strconv.ParseInt(panelID, 10, 64)
		if err != nil {
			return fmt.Errorf("annotation %s must be a valid integer Panel ID",
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

func (k AlertRuleKey) LogContext() []interface{} {
	return []interface{}{"rule_uid", k.UID, "org_id", k.OrgID}
}

type AlertRuleKeyWithVersion struct {
	Version      int64
	AlertRuleKey `xorm:"extends"`
}

type AlertRuleKeyWithVersionAndPauseStatus struct {
	IsPaused                bool
	AlertRuleKeyWithVersion `xorm:"extends"`
}

// AlertRuleGroupKey is the identifier of a group of alerts
type AlertRuleGroupKey struct {
	OrgID        int64
	NamespaceUID string
	RuleGroup    string
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

// GetGroupKey returns the identifier of a group the rule belongs to
func (alertRule *AlertRule) GetGroupKey() AlertRuleGroupKey {
	return AlertRuleGroupKey{OrgID: alertRule.OrgID, NamespaceUID: alertRule.NamespaceUID, RuleGroup: alertRule.RuleGroup}
}

// PreSave sets default values and loads the updated model for each alert query.
func (alertRule *AlertRule) PreSave(timeNow func() time.Time) error {
	for i, q := range alertRule.Data {
		err := q.PreSave()
		if err != nil {
			return fmt.Errorf("invalid alert query %s: %w", q.RefID, err)
		}
		alertRule.Data[i] = q
	}
	alertRule.Updated = timeNow()
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

// AlertRuleVersion is the model for alert rule versions in unified alerting.
type AlertRuleVersion struct {
	ID               int64  `xorm:"pk autoincr 'id'"`
	RuleOrgID        int64  `xorm:"rule_org_id"`
	RuleUID          string `xorm:"rule_uid"`
	RuleNamespaceUID string `xorm:"rule_namespace_uid"`
	RuleGroup        string
	RuleGroupIndex   int `xorm:"rule_group_idx"`
	ParentVersion    int64
	RestoredFrom     int64
	Version          int64

	Created         time.Time
	Title           string
	Condition       string
	Data            []AlertQuery
	IntervalSeconds int64
	NoDataState     NoDataState
	ExecErrState    ExecutionErrorState
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For         time.Duration
	Annotations map[string]string
	Labels      map[string]string
	IsPaused    bool
}

// GetAlertRuleByUIDQuery is the query for retrieving/deleting an alert rule by UID and organisation ID.
type GetAlertRuleByUIDQuery struct {
	UID   string
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
	NamespaceUIDs []string
	ExcludeOrgs   []int64
	RuleGroup     string

	// DashboardUID and PanelID are optional and allow filtering rules
	// to return just those for a dashboard and panel.
	DashboardUID string
	PanelID      int64
}

// CountAlertRulesQuery is the query for counting alert rules
type CountAlertRulesQuery struct {
	OrgID        int64
	NamespaceUID string
}

type GetAlertRulesForSchedulingQuery struct {
	PopulateFolders bool

	ResultRules         []*AlertRule
	ResultFoldersTitles map[string]string
}

// ListNamespaceAlertRulesQuery is the query for listing namespace alert rules
type ListNamespaceAlertRulesQuery struct {
	OrgID int64
	// Namespace is the folder slug
	NamespaceUID string
}

// ListOrgRuleGroupsQuery is the query for listing unique rule groups
// for an organization
type ListOrgRuleGroupsQuery struct {
	OrgID         int64
	NamespaceUIDs []string

	// DashboardUID and PanelID are optional and allow filtering rules
	// to return just those for a dashboard and panel.
	DashboardUID string
	PanelID      int64
}

type UpdateRule struct {
	Existing *AlertRule
	New      AlertRule
}

// Condition contains backend expressions and queries and the RefID
// of the query or expression that will be evaluated.
type Condition struct {
	// Condition is the RefID of the query or expression from
	// the Data property to get the results for.
	Condition string `json:"condition"`

	// Data is an array of data source queries and/or server side expressions.
	Data []AlertQuery `json:"data"`
}

// IsValid checks the condition's validity.
func (c Condition) IsValid() bool {
	// TODO search for refIDs in QueriesAndExpressions
	return len(c.Data) != 0
}

// PatchPartialAlertRule patches `ruleToPatch` by `existingRule` following the rule that if a field of `ruleToPatch` is empty or has the default value, it is populated by the value of the corresponding field from `existingRule`.
// There are several exceptions:
// 1. Following fields are not patched and therefore will be ignored: AlertRule.ID, AlertRule.OrgID, AlertRule.Updated, AlertRule.Version, AlertRule.UID, AlertRule.DashboardUID, AlertRule.PanelID, AlertRule.Annotations and AlertRule.Labels
// 2. There are fields that are patched together:
//   - AlertRule.Condition and AlertRule.Data
//
// If either of the pair is specified, neither is patched.
func PatchPartialAlertRule(existingRule *AlertRule, ruleToPatch *AlertRuleWithOptionals) {
	if ruleToPatch.Title == "" {
		ruleToPatch.Title = existingRule.Title
	}
	if ruleToPatch.Condition == "" || len(ruleToPatch.Data) == 0 {
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
	if !ruleToPatch.HasPause {
		ruleToPatch.IsPaused = existingRule.IsPaused
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

func (g RulesGroup) SortByGroupIndex() {
	sort.Slice(g, func(i, j int) bool {
		if g[i].RuleGroupIndex == g[j].RuleGroupIndex {
			return g[i].ID < g[j].ID
		}
		return g[i].RuleGroupIndex < g[j].RuleGroupIndex
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
