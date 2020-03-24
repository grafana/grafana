package usagestats

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

type datasourceAlertUsage struct {
	datasourceType string
	count          int
}

func (uss *UsageStatsService) getAlertingUsage() ([]datasourceAlertUsage, error) {
	//map of datasource IDs with counter
	// datsourceIds := map[int64]int{}

	// cmd := &models.GetAllAlertsQuery{}

	// if err := uss.Bus.Dispatch(cmd); err != nil {
	// 	uss.log.Error("Could not load alerts", "error", err)
	// 	return []datasourceAlertUsage{}, err
	// }

	return []datasourceAlertUsage{}, nil
}

func (uss *UsageStatsService) mapRulesToUsageStats(rules []*models.Alert) ([]datasourceAlertUsage, error) {
	return []datasourceAlertUsage{}, nil
}

func (uss *UsageStatsService) parseAlertRuleModel(bytes json.RawMessage) ([]int64, error) {
	datasourceIDs := []int64{}
	alertJsonModel := AlertJsonModel{}

	err := json.Unmarshal(bytes, &alertJsonModel)
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
