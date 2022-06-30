package alerting

import (
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type configVersion struct {
	APIVersion values.Int64Value `json:"apiVersion" yaml:"apiVersion"`
}

type RuleFileV1 struct {
	configVersion
	Groups         []AlertRuleGroupV1 `json:"groups" yaml:"groups"`
	DeleteRulesUID []string           `json:"deleteRules" yaml:"deleteRules"`
}

type AlertRuleGroupV1 struct {
	OrgID    values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name     values.StringValue `json:"name" yaml:"name"`
	Folder   values.StringValue `json:"folder" yaml:"folder"`
	Interval values.StringValue `json:"interval" yaml:"interval"`
	Rules    []AlertRuleV1      `json:"rules" yaml:"rules"`
}

type AlertRuleV1 struct {
	UID          values.StringValue    `json:"uid" yaml:"uid"`
	OrgID        values.Int64Value     `json:"orgId" yaml:"orgId"`
	Title        values.StringValue    `json:"title" yaml:"title"`
	Condition    values.StringValue    `json:"condition" yaml:"condition"`
	Data         []QueryV1             `json:"data" yaml:"data"`
	DashboardUID values.StringValue    `json:"dasboardUid" yaml:"dashboardUid"`
	PanelID      values.StringValue    `json:"panelId" yaml:"panelId"`
	NoDataState  values.StringValue    `json:"noDataState" yaml:"noDataState"`
	ExecErrState values.StringValue    `json:"execErrState" yaml:"execErrState"`
	For          values.StringValue    `json:"for" yaml:"for"`
	Annotations  values.StringMapValue `json:"annotations" yaml:"annotations"`
	Labels       values.StringMapValue `json:"labels" yaml:"labels"`
}

type QueryV1 struct {
	RefID             values.StringValue  `json:"refId" yaml:"refId"`
	QueryType         values.StringValue  `json:"queryType" yaml:"queryType"`
	RelativeTimeRange RelativeTimeRangeV1 `json:"relativeTimeRange" yaml:"relativeTimeRange"`
	DatasourceUID     values.StringValue  `json:"datasourceUid" yaml:"datasourceUid"`
	Model             values.JSONValue    `json:"model" yaml:"model"`
}

type RelativeTimeRangeV1 struct {
	From values.Int64Value `json:"from" yaml:"from"`
	To   values.Int64Value `json:"to" yaml:"to"`
}
