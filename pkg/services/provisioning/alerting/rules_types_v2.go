package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type AlertRuleGroupV2 struct {
	OrgID    values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name     values.StringValue `json:"name" yaml:"name"`
	Folder   values.StringValue `json:"folder" yaml:"folder"`
	Interval values.StringValue `json:"interval" yaml:"interval"`
	Rules    []AlertRuleV2      `json:"rules" yaml:"rules"`
}

func (group *AlertRuleGroupV2) mapToModel(ds datasources.DataSourceService) (models.AlertRuleGroupWithFolderTitle, error) {
	for _, rule := range group.Rules {
		rule.mapToModel(0, ds)
	}
	return models.AlertRuleGroupWithFolderTitle{}, nil
}

type AlertRuleV2 struct {
	UID          values.StringValue    `json:"uid" yaml:"uid"`
	Title        values.StringValue    `json:"title" yaml:"title"`
	Datasource   values.StringValue    `json:"datasource" yaml:"datasource"`
	Expr         values.StringValue    `json:"expr" yaml:"expr"`
	Aggr         values.StringValue    `json:"aggr" yaml:"aggr"`
	Condition    values.StringValue    `json:"condiation" yaml:"condition"`
	For          values.StringValue    `json:"for" yaml:"for"`
	Labels       values.StringMapValue `json:"labels" yaml:"labels"`
	Annotations  values.StringMapValue `json:"annotations" yaml:"annotations"`
	ExecErrState values.StringValue    `json:"execErrState" yaml:"execErrState"`
	NoDataState  values.StringValue    `json:"noDataState" yaml:"noDataState"`
	IsPaused     values.BoolValue      `json:"isPaused" yaml:"isPaused"`
}

func (rule *AlertRuleV2) mapToModel(orgID int64, dss datasources.DataSourceService) (models.AlertRule, error) {
	ds, err := dss.GetDataSource(context.Background(), &datasources.GetDataSourceQuery{
		UID: rule.Datasource.Value(),
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	if !isSupportedType(ds.Type) {
		return models.AlertRule{}, fmt.Errorf("alert rule of type %s in not yet supported with v2", ds.Type)
	}
	outRule := models.AlertRule{
		UID:       rule.UID.Value(),
		OrgID:     orgID,
		Title:     rule.Title.Value(),
		Condition: refIDCondition,
	}
	outRule.Data, err = generateAlertQuery(ds.Type, ds.UID, rule.Expr.Value(), rule.Aggr.Value(), rule.Condition.Value())
	if err != nil {
		return models.AlertRule{}, err
	}
	// We can go from here
	return outRule, nil
}
