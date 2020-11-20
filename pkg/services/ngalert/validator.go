package ngalert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/expr"
)

// validateAlertDefinition validates that the alert definition contains at least one alert query
// and that alert queries refer to existing datasources.
func (ng *AlertNG) validateAlertDefinition(alertDefinition *AlertDefinition) error {
	if len(alertDefinition.Data) == 0 {
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
