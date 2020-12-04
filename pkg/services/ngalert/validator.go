package ngalert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/expr"
)

// validateAlertDefinition validates that the alert definition that alert queries refer to existing datasources.
// if requireData is true checks that it contains at least one alert query
func (ng *AlertNG) validateAlertDefinition(alertDefinition *AlertDefinition, requireData bool) error {
	if !requireData && len(alertDefinition.Data) == 0 {
		return fmt.Errorf("no queries or expressions are found")
	}

	for _, query := range alertDefinition.Data {
		datasourceID, err := query.GetDatasource()
		if err != nil {
			return err
		}

		if datasourceID == expr.DatasourceID {
			return nil
		}

		_, err = ng.DatasourceCache.GetDatasource(datasourceID, alertDefinition.OrgId, false)
		if err != nil {
			return err
		}
	}
	return nil
}
