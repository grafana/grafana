package alerting

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

// DatasourceAlertUsage is a hash where the key represents the
// Datasource type and the value represents how many alerts
// that use the datasources.
type DatasourceAlertUsage map[string]int

// UsageStats contains stats about alert rules configured in
// Grafana.
type UsageStats struct {
	DatasourceUsage DatasourceAlertUsage
}

// UsageStatsQuerier returns usage stats about alert rules
// configured in Grafana.
type UsageStatsQuerier interface {
	QueryUsageStats() (*UsageStats, error)
}

// QueryUsageStats returns usage stats about alert rules
// configured in Grafana.
func (ae *AlertEngine) QueryUsageStats() (*UsageStats, error) {
	cmd := &models.GetAllAlertsQuery{}
	err := ae.Bus.Dispatch(cmd)
	if err != nil {
		return nil, err
	}

	dsUsage, err := ae.mapRulesToUsageStats(cmd.Result)
	if err != nil {
		return nil, err
	}

	return &UsageStats{
		DatasourceUsage: dsUsage,
	}, nil
}

func (ae *AlertEngine) mapRulesToUsageStats(rules []*models.Alert) (DatasourceAlertUsage, error) {
	// map of datasourceId type and frequency
	typeCount := map[int64]int{}
	for _, a := range rules {
		dss, err := ae.parseAlertRuleModel(a.Settings)
		if err != nil {
			ae.log.Debug("could not parse settings for alert rule", "id", a.Id)
			continue
		}

		for _, d := range dss {
			// aggregated datasource usage based on datasource id
			typeCount[d]++
		}
	}

	// map of datsource types and frequency
	result := map[string]int{}
	for k, v := range typeCount {
		query := &models.GetDataSourceByIdQuery{Id: k}
		err := ae.Bus.Dispatch(query)
		if err != nil {
			return map[string]int{}, nil
		}

		// aggregate datasource usages based on datasource type
		result[query.Result.Type] += v
	}

	return result, nil
}

func (ae *AlertEngine) parseAlertRuleModel(settings json.Marshaler) ([]int64, error) {
	datasourceIDs := []int64{}
	model := alertJSONModel{}

	if settings == nil {
		return datasourceIDs, nil
	}

	bytes, err := settings.MarshalJSON()
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(bytes, &model)
	if err != nil {
		return datasourceIDs, err
	}

	for _, condition := range model.Conditions {
		datasourceIDs = append(datasourceIDs, condition.Query.DatasourceID)
	}

	return datasourceIDs, nil
}

type alertCondition struct {
	Query *conditionQuery `json:"query"`
}

type conditionQuery struct {
	DatasourceID int64 `json:"datasourceId"`
}

type alertJSONModel struct {
	Conditions []*alertCondition `json:"conditions"`
}
