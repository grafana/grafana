package alerting

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

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

func (ruleGroupV1 *AlertRuleGroupV1) MapToModel() (AlertRuleGroup, error) {
	ruleGroup := AlertRuleGroup{}
	ruleGroup.Name = ruleGroupV1.Name.Value()
	if strings.TrimSpace(ruleGroup.Name) == "" {
		return AlertRuleGroup{}, errors.New("rule group has no name set")
	}
	ruleGroup.OrgID = ruleGroupV1.OrgID.Value()
	if ruleGroup.OrgID < 1 {
		ruleGroup.OrgID = 1
	}
	interval, err := time.ParseDuration(ruleGroupV1.Interval.Value())
	if err != nil {
		return AlertRuleGroup{}, err
	}
	ruleGroup.Interval = interval
	ruleGroup.Folder = ruleGroupV1.Folder.Value()
	if strings.TrimSpace(ruleGroup.Folder) == "" {
		return AlertRuleGroup{}, errors.New("rule group has no folder set")
	}
	for _, ruleV1 := range ruleGroupV1.Rules {
		rule, err := ruleV1.mapToModel(ruleGroup.OrgID)
		if err != nil {
			return AlertRuleGroup{}, err
		}
		ruleGroup.Rules = append(ruleGroup.Rules, rule)
	}
	return ruleGroup, nil
}

type AlertRuleGroup struct {
	OrgID    int64
	Name     string
	Folder   string
	Interval time.Duration
	Rules    []models.AlertRule
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
	duration, err := time.ParseDuration(rule.For.Value())
	if err != nil {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
	}
	alertRule.For = duration
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
