package ngalert

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

const alertDefinitionMaxNameLength = 190

// validateAlertDefinition validates the alert definition interval and organisation.
// If requireData is true checks that it contains at least one alert query
func (ng *AlertNG) validateAlertDefinition(alertDefinition *AlertDefinition, requireData bool) error {
	if !requireData && len(alertDefinition.Data) == 0 {
		return fmt.Errorf("no queries or expressions are found")
	}

	if alertDefinition.IntervalSeconds%int64(ng.schedule.baseInterval.Seconds()) != 0 {
		return fmt.Errorf("invalid interval: %v: interval should be divided exactly by scheduler interval: %v", time.Duration(alertDefinition.IntervalSeconds)*time.Second, ng.schedule.baseInterval)
	}

	// enfore max name length in SQLite
	if len(alertDefinition.Title) > alertDefinitionMaxNameLength {
		return fmt.Errorf("name length should not be greater than %d", alertDefinitionMaxNameLength)
	}

	if alertDefinition.OrgID == 0 {
		return fmt.Errorf("no organisation is found")
	}

	return nil
}

// validateCondition validates that condition queries refer to existing datasources
func (ng *AlertNG) validateCondition(c eval.Condition, user *models.SignedInUser) error {
	var refID string

	if len(c.QueriesAndExpressions) == 0 {
		return nil
	}

	for _, query := range c.QueriesAndExpressions {
		if c.RefID == query.RefID {
			refID = c.RefID
		}

		datasourceID, err := query.GetDatasource()
		if err != nil {
			return err
		}

		if datasourceID == expr.DatasourceID {
			continue
		}

		_, err = ng.DatasourceCache.GetDatasource(datasourceID, user, false)
		if err != nil {
			return err
		}
	}

	if refID == "" {
		return fmt.Errorf("condition %s not found in any query or expression", c.RefID)
	}
	return nil
}
