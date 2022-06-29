package alerting

import (
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type configVersion struct {
	APIVersion values.Int64Value `json:"apiVersion" yaml:"apiVersion"`
}

type ConfigV1 struct {
	configVersion
	Groups []AlertRuleGroupV1 `json:"groups" yaml:"groups"`
}

type AlertRuleGroupV1 struct {
	OrgID    values.Int64Value  `json:"orgID" yaml:"orgID"`
	Name     values.StringValue `json:"name" yaml:"name"`
	Folder   values.StringValue `json:"folder" yaml:"folder"`
	Interval values.Int64Value  `json:"interval" yaml:"interval"`
	Rules    []AlertRuleV1      `json:"rules" yaml:"rules"`
}

type AlertRuleV1 struct {
	UID          values.StringValue    `json:"uid" yaml:"uid"`
	OrgID        values.Int64Value     `json:"orgID" yaml:"orgID"`
	Title        values.StringValue    `json:"title" yaml:"title"`
	Condition    values.StringValue    `json:"condition" yaml:"condition"`
	Data         []QueryV1             `json:"data" yaml:"data"`
	DashboardUID values.StringValue    `json:"dasboardUID" yaml:"dashboardUID"`
	PanelID      values.StringValue    `json:"panelID" yaml:"panelID"`
	NoDataState  values.StringValue    `json:"noDataState" yaml:"noDataState"`
	ExecErrState values.StringValue    `json:"execErrState" yaml:"execErrState"`
	For          values.StringValue    `json:"for" yaml:"for"`
	Annotations  values.StringMapValue `json:"annotations" yaml:"annotations"`
	Labels       values.StringMapValue `json:"labels" yaml:"labels"`
}

type QueryV1 struct {
	Data values.JSONValue
}
