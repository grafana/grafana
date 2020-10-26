package ngalert

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func (ng *AlertNG) validate(alertDefinition *AlertDefinition, signedInUser *models.SignedInUser, skipCache bool) error {
	var ds *models.DataSource

	if len(alertDefinition.Data) == 0 {
		return fmt.Errorf("no queries and expressions are found")
	}

	for index, query := range alertDefinition.Data {
		model := make(map[string]interface{})
		err := json.Unmarshal(query.JSON, &model)
		if err != nil {
			return fmt.Errorf("failed to unmarshal query model %w", err)
		}

		i := model["datasource"]
		dsName, _ := i.(string)
		if dsName != "__expr__" {
			i, ok := model["datasourceId"]
			if !ok {
				return fmt.Errorf("failed to get datasourceId from query model")
			}
			datasourceID, ok := i.(float64)
			if !ok {
				return fmt.Errorf("failed to cast datasourceId to int64")
			}

			ds, err = ng.DatasourceCache.GetDatasource(int64(datasourceID), signedInUser, skipCache)
			if err != nil {
				return err
			}
		} else {
			ds = &models.DataSource{Name: dsName, Id: -100}
		}

		if ds == nil && dsName != "__expr__" {
			return fmt.Errorf("no datasource reference found")
		}

		if dsName == "" {
			model["datasource"] = ds.Name
		}

		i, ok := model["datasourceId"]
		if !ok {
			model["datasourceId"] = ds.Id
		} else {
			datasourceID, ok := i.(int64)
			if !ok || datasourceID == 0 {
				model["datasourceId"] = ds.Id
			}
		}

		/*
			i, ok = model["orgId"] // GEL requires orgID inside the query JSON
			if !ok {
				model["orgId"] = alertDefinition.OrgId
			} else {
				orgID, ok := i.(int64)
				if !ok || orgID == 0 {
					model["orgId"] = alertDefinition.OrgId
				}
			}
		*/

		const defaultMaxDataPoints = 100
		var maxDataPoints float64
		i, ok = model["maxDataPoints"] // GEL requires maxDataPoints inside the query JSON
		if !ok {
			maxDataPoints = defaultMaxDataPoints
		} else {
			maxDataPoints, ok = i.(float64)
			fmt.Printf("%T %v %v %v\n", i, i, maxDataPoints, ok)
			if !ok || maxDataPoints == 0 {
				maxDataPoints = defaultMaxDataPoints
			}
		}
		model["maxDataPoints"] = maxDataPoints
		query.MaxDataPoints = int64(maxDataPoints)

		// intervalMS is calculated by the frontend
		// should we do something similar?
		const defaultIntervalMs = 1000
		var intervalMs float64
		i, ok = model["intervalMs"] // GEL requires intervalMs inside the query JSON
		if !ok {
			intervalMs = defaultIntervalMs
		} else {
			intervalMs, ok = i.(float64)
			if !ok || i == 0 {
				intervalMs = defaultIntervalMs
			}
		}
		model["intervalMs"] = intervalMs
		query.Interval = time.Duration(int64(intervalMs)) * time.Millisecond

		if query.JSON, err = json.Marshal(model); err != nil {
			return fmt.Errorf("unable to marshal query model %w", err)
		}
		alertDefinition.Data[index] = query
	}

	return nil
}
