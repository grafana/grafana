package ngalert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/models"
)

// validateAlertDefinition validates that the alert definition contains at least one alert query
// and that alert queries refer to existing datasources.
func (ng *AlertNG) validateAlertDefinition(alertDefinition *AlertDefinition, signedInUser *models.SignedInUser, skipCache bool) error {
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

		_, err = ng.DatasourceCache.GetDatasource(datasourceID, signedInUser, skipCache)
		if err != nil {
			return err
		}
	}
	return nil
}
