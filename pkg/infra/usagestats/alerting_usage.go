package usagestats

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type DatasourceAlertUsage map[string]int

func (uss *UsageStatsService) getAlertingUsage() (DatasourceAlertUsage, error) {
	cmd := &models.GetAllAlertsQuery{}
	err := uss.Bus.Dispatch(cmd)
	if err != nil {
		return map[string]int{}, err
	}

	return uss.mapRulesToUsageStats(cmd.Result)
}

func (uss *UsageStatsService) mapRulesToUsageStats(rules []*models.Alert) (DatasourceAlertUsage, error) {
	// map of datasourceId type and frequency
	typeCount := map[int64]int{}

	for _, a := range rules {
		dss, err := uss.parseAlertRuleModel(a.Settings)
		if err != nil {
			uss.log.Error("could not parse alert rule", "id", a.Id)
			continue
		}

		for _, d := range dss {
			typeCount[d]++
		}
	}

	result := map[string]int{}
	for k, v := range typeCount {
		query := &models.GetDataSourceByIdQuery{Id: k}
		err := uss.Bus.Dispatch(query)
		if err != nil {
			return map[string]int{}, nil
		}

		result[query.Result.Type] = v
	}

	return result, nil
}

func (uss *UsageStatsService) parseAlertRuleModel(settings *simplejson.Json) ([]int64, error) {
	datasourceIDs := []int64{}
	model := alertJsonModel{}

	if settings == nil {
		return datasourceIDs, nil
	}

	bytes, err := settings.MarshalJSON()

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

type alertJsonModel struct {
	Conditions []*alertCondition `json:"conditions"`
}
