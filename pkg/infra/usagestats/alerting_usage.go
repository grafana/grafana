package usagestats

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type datasourceAlertUsage struct {
	datasourceType string
	count          int
}

func (uss *UsageStatsService) getAlertingUsage() (map[string]int, error) {
	cmd := &models.GetAllAlertsQuery{}

	if err := uss.Bus.Dispatch(cmd); err != nil {
		uss.log.Error("Could not load alerts", "error", err)
		return map[string]int{}, err
	}

	return uss.mapRulesToUsageStats(cmd.Result)
}

func (uss *UsageStatsService) mapRulesToUsageStats(rules []*models.Alert) (map[string]int, error) {
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

	r := map[string]int{}
	for k, v := range typeCount {
		query := &models.GetDataSourceByIdQuery{Id: k}
		err := uss.Bus.Dispatch(query)
		if err != nil {
			return map[string]int{}, nil
		}

		r[query.Result.Type] = v
	}

	return r, nil
}

func (uss *UsageStatsService) parseAlertRuleModel(settings *simplejson.Json) ([]int64, error) {
	datasourceIDs := []int64{}
	alertJsonModel := AlertJsonModel{}

	if settings == nil {
		return datasourceIDs, nil
	}

	bytes, err := settings.MarshalJSON()

	err = json.Unmarshal(bytes, &alertJsonModel)
	if err != nil {
		return datasourceIDs, err
	}

	for _, condition := range alertJsonModel.Conditions {
		datasourceIDs = append(datasourceIDs, condition.Query.DatasourceID)
	}

	return datasourceIDs, nil
}

type AlertCondition struct {
	Query *ConditionQuery `json:"query"`
}

type ConditionQuery struct {
	DatasourceID int64 `json:"datasourceId"`
}

type AlertJsonModel struct {
	Conditions []*AlertCondition `json:"conditions"`
}
