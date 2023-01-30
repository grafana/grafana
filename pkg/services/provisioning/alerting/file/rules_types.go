package file

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type RuleDelete struct {
	UID   string
	OrgID int64
}

type RuleDeleteV1 struct {
	UID   values.StringValue `json:"uid" yaml:"uid"`
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
}

type AlertRuleGroupV1 struct {
	OrgID    values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name     values.StringValue `json:"name" yaml:"name"`
	Folder   values.StringValue `json:"folder" yaml:"folder"`
	Interval values.StringValue `json:"interval" yaml:"interval"`
	Rules    []AlertRuleV1      `json:"rules" yaml:"rules"`
}

func (ruleGroupV1 *AlertRuleGroupV1) MapToModel() (AlertRuleGroupWithFolderTitle, error) {
	ruleGroup := AlertRuleGroupWithFolderTitle{AlertRuleGroup: &models.AlertRuleGroup{}}
	ruleGroup.Title = ruleGroupV1.Name.Value()
	if strings.TrimSpace(ruleGroup.Title) == "" {
		return AlertRuleGroupWithFolderTitle{}, errors.New("rule group has no name set")
	}
	ruleGroup.OrgID = ruleGroupV1.OrgID.Value()
	if ruleGroup.OrgID < 1 {
		ruleGroup.OrgID = 1
	}
	interval, err := model.ParseDuration(ruleGroupV1.Interval.Value())
	if err != nil {
		return AlertRuleGroupWithFolderTitle{}, err
	}
	ruleGroup.Interval = int64(time.Duration(interval).Seconds())
	ruleGroup.FolderTitle = ruleGroupV1.Folder.Value()
	if strings.TrimSpace(ruleGroup.FolderTitle) == "" {
		return AlertRuleGroupWithFolderTitle{}, errors.New("rule group has no folder set")
	}
	for _, ruleV1 := range ruleGroupV1.Rules {
		rule, err := ruleV1.mapToModel(ruleGroup.OrgID)
		if err != nil {
			return AlertRuleGroupWithFolderTitle{}, err
		}
		ruleGroup.Rules = append(ruleGroup.Rules, rule)
	}
	return ruleGroup, nil
}

type AlertRuleGroupWithFolderTitle struct {
	*models.AlertRuleGroup
	OrgID       int64
	FolderTitle string
}

type AlertRuleV1 struct {
	UID          values.StringValue    `json:"uid" yaml:"uid"`
	Title        values.StringValue    `json:"title" yaml:"title"`
	Condition    values.StringValue    `json:"condition" yaml:"condition"`
	Data         []QueryV1             `json:"data" yaml:"data"`
	DashboardUID values.StringValue    `json:"dasboardUid" yaml:"dashboardUid"`
	PanelID      values.Int64Value     `json:"panelId" yaml:"panelId"`
	NoDataState  values.StringValue    `json:"noDataState" yaml:"noDataState"`
	ExecErrState values.StringValue    `json:"execErrState" yaml:"execErrState"`
	For          values.StringValue    `json:"for" yaml:"for"`
	Annotations  values.StringMapValue `json:"annotations" yaml:"annotations"`
	Labels       values.StringMapValue `json:"labels" yaml:"labels"`
	IsPaused     values.BoolValue      `json:"isPaused" yaml:"isPaused"`
}

func (rule *AlertRuleV1) mapToModel(orgID int64) (models.AlertRule, error) {
	alertRule := models.AlertRule{}
	alertRule.Title = rule.Title.Value()
	if alertRule.Title == "" {
		return models.AlertRule{}, fmt.Errorf("rule has no title set")
	}
	alertRule.UID = rule.UID.Value()
	if alertRule.UID == "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: no UID set", alertRule.Title)
	}
	alertRule.OrgID = orgID
	duration, err := model.ParseDuration(rule.For.Value())
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
	}
	alertRule.For = time.Duration(duration)
	dashboardUID := rule.DashboardUID.Value()
	alertRule.DashboardUID = &dashboardUID
	panelID := rule.PanelID.Value()
	alertRule.PanelID = &panelID
	execErrStateValue := strings.TrimSpace(rule.ExecErrState.Value())
	execErrState, err := models.ErrStateFromString(execErrStateValue)
	if err != nil && execErrStateValue != "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
	}
	if execErrStateValue == "" {
		execErrState = models.AlertingErrState
	}
	alertRule.ExecErrState = execErrState
	noDataStateValue := strings.TrimSpace(rule.NoDataState.Value())
	noDataState, err := models.NoDataStateFromString(noDataStateValue)
	if err != nil && noDataStateValue != "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
	}
	if noDataStateValue == "" {
		noDataState = models.NoData
	}
	alertRule.NoDataState = noDataState
	alertRule.Condition = rule.Condition.Value()
	if alertRule.Condition == "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: no condition set", alertRule.Title)
	}
	alertRule.Annotations = rule.Annotations.Raw
	alertRule.Labels = rule.Labels.Value()
	for _, queryV1 := range rule.Data {
		query, err := queryV1.mapToModel()
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
		}
		alertRule.Data = append(alertRule.Data, query)
	}
	if len(alertRule.Data) == 0 {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: no data set", alertRule.Title)
	}
	alertRule.IsPaused = rule.IsPaused.Value()
	return alertRule, nil
}

type QueryV1 struct {
	RefID             values.StringValue       `json:"refId" yaml:"refId"`
	QueryType         values.StringValue       `json:"queryType" yaml:"queryType"`
	RelativeTimeRange models.RelativeTimeRange `json:"relativeTimeRange" yaml:"relativeTimeRange"`
	DatasourceUID     values.StringValue       `json:"datasourceUid" yaml:"datasourceUid"`
	Model             values.JSONValue         `json:"model" yaml:"model"`
}

func (queryV1 *QueryV1) mapToModel() (models.AlertQuery, error) {
	// In order to get the model into the format we need,
	// we marshal it back to json and unmarshal it again
	// in json.RawMessage. We do this as we cannot use
	// json.RawMessage with a yaml files and have to use
	// JSONValue that supports both, json and yaml.
	//
	// We have to use the Raw field here, as Value would
	// try to interpolate macros like `$__timeFilter`, resulting
	// in missing macros in the SQL queries as they would be
	// replaced by an empty string.
	encoded, err := json.Marshal(queryV1.Model.Raw)
	if err != nil {
		return models.AlertQuery{}, err
	}
	var rawMessage json.RawMessage
	err = json.Unmarshal(encoded, &rawMessage)
	if err != nil {
		return models.AlertQuery{}, err
	}
	return models.AlertQuery{
		RefID:             queryV1.RefID.Value(),
		QueryType:         queryV1.QueryType.Value(),
		DatasourceUID:     queryV1.DatasourceUID.Value(),
		RelativeTimeRange: queryV1.RelativeTimeRange,
		Model:             rawMessage,
	}, nil
}

// Response structs

// AlertingFileExport is the full provisioned file export.
// swagger:model
type AlertingFileExport struct {
	APIVersion int64                  `json:"apiVersion" yaml:"apiVersion"`
	Groups     []AlertRuleGroupExport `json:"groups" yaml:"groups"`
}

// AlertRuleGroupExport is the provisioned file export of AlertRuleGroupV1.
type AlertRuleGroupExport struct {
	OrgID    int64             `json:"orgId" yaml:"orgId"`
	Name     string            `json:"name" yaml:"name"`
	Folder   string            `json:"folder" yaml:"folder"`
	Interval model.Duration    `json:"interval" yaml:"interval"`
	Rules    []AlertRuleExport `json:"rules" yaml:"rules"`
}

// AlertRuleExport is the provisioned file export of models.AlertRule.
type AlertRuleExport struct {
	UID          string                     `json:"uid" yaml:"uid"`
	Title        string                     `json:"title" yaml:"title"`
	Condition    string                     `json:"condition" yaml:"condition"`
	Data         []AlertQueryExport         `json:"data" yaml:"data"`
	DashboardUID string                     `json:"dasboardUid,omitempty" yaml:"dashboardUid,omitempty"`
	PanelID      int64                      `json:"panelId,omitempty" yaml:"panelId,omitempty"`
	NoDataState  models.NoDataState         `json:"noDataState" yaml:"noDataState"`
	ExecErrState models.ExecutionErrorState `json:"execErrState" yaml:"execErrState"`
	For          model.Duration             `json:"for" yaml:"for"`
	Annotations  map[string]string          `json:"annotations,omitempty" yaml:"annotations,omitempty"`
	Labels       map[string]string          `json:"labels,omitempty" yaml:"labels,omitempty"`
	IsPaused     bool                       `json:"isPaused" yaml:"isPaused"`
}

// AlertQueryExport is the provisioned export of models.AlertQuery.
type AlertQueryExport struct {
	RefID             string                   `json:"refId" yaml:"refId"`
	QueryType         string                   `json:"queryType,omitempty" yaml:"queryType,omitempty"`
	RelativeTimeRange models.RelativeTimeRange `json:"relativeTimeRange,omitempty" yaml:"relativeTimeRange,omitempty"`
	DatasourceUID     string                   `json:"datasourceUid" yaml:"datasourceUid"`
	Model             map[string]interface{}   `json:"model" yaml:"model"`
}

// NewAlertingFileExport creates an AlertingFileExport DTO from []AlertRuleGroupWithFolderTitle.
func NewAlertingFileExport(groups []AlertRuleGroupWithFolderTitle) (AlertingFileExport, error) {
	f := AlertingFileExport{APIVersion: 1}
	for _, group := range groups {
		export, err := newAlertRuleGroupExport(group)
		if err != nil {
			return AlertingFileExport{}, err
		}
		f.Groups = append(f.Groups, export)
	}
	return f, nil
}

// newAlertRuleGroupExport creates a AlertRuleGroupExport DTO from models.AlertRuleGroup.
func newAlertRuleGroupExport(d AlertRuleGroupWithFolderTitle) (AlertRuleGroupExport, error) {
	rules := make([]AlertRuleExport, 0, len(d.Rules))
	for i := range d.Rules {
		alert, err := newAlertRuleExport(d.Rules[i])
		if err != nil {
			return AlertRuleGroupExport{}, err
		}
		rules = append(rules, alert)
	}
	return AlertRuleGroupExport{
		OrgID:    d.OrgID,
		Name:     d.Title,
		Folder:   d.FolderTitle,
		Interval: model.Duration(time.Duration(d.Interval) * time.Second),
		Rules:    rules,
	}, nil
}

// newAlertRuleExport creates a AlertRuleExport DTO from models.AlertRule.
func newAlertRuleExport(rule models.AlertRule) (AlertRuleExport, error) {
	data := make([]AlertQueryExport, 0, len(rule.Data))
	for i := range rule.Data {
		query, err := newAlertQueryExport(rule.Data[i])
		if err != nil {
			return AlertRuleExport{}, err
		}
		data = append(data, query)
	}

	var dashboardUID string
	if rule.DashboardUID != nil {
		dashboardUID = *rule.DashboardUID
	}

	var panelID int64
	if rule.PanelID != nil {
		panelID = *rule.PanelID
	}

	return AlertRuleExport{
		UID:          rule.UID,
		Title:        rule.Title,
		For:          model.Duration(rule.For),
		Condition:    rule.Condition,
		Data:         data,
		DashboardUID: dashboardUID,
		PanelID:      panelID,
		NoDataState:  rule.NoDataState,
		ExecErrState: rule.ExecErrState,
		Annotations:  rule.Annotations,
		Labels:       rule.Labels,
		IsPaused:     rule.IsPaused,
	}, nil
}

// newAlertQueryExport creates a AlertQueryExport DTO from models.AlertQuery.
func newAlertQueryExport(query models.AlertQuery) (AlertQueryExport, error) {
	// We unmarshal the json.RawMessage model into a map in order to facilitate yaml marshalling.
	var mdl map[string]interface{}
	err := json.Unmarshal(query.Model, &mdl)
	if err != nil {
		return AlertQueryExport{}, err
	}
	return AlertQueryExport{
		RefID:             query.RefID,
		QueryType:         query.QueryType,
		RelativeTimeRange: query.RelativeTimeRange,
		DatasourceUID:     query.DatasourceUID,
		Model:             mdl,
	}, nil
}
