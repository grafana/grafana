package ngalert

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

const alertDefinitionMaxTitleLength = 190

var errEmptyTitleError = errors.New("title is empty")

// validateAlertDefinition validates the alert definition interval and organisation.
// If requireData is true checks that it contains at least one alert query
func (ng *AlertNG) validateAlertDefinition(alertDefinition *AlertDefinition, requireData bool) error {
	if !requireData && len(alertDefinition.Data) == 0 {
		return fmt.Errorf("no queries or expressions are found")
	}

	if alertDefinition.Title == "" {
		return errEmptyTitleError
	}

	if alertDefinition.IntervalSeconds%int64(ng.schedule.baseInterval.Seconds()) != 0 {
		return fmt.Errorf("invalid interval: %v: interval should be divided exactly by scheduler interval: %v", time.Duration(alertDefinition.IntervalSeconds)*time.Second, ng.schedule.baseInterval)
	}

	// enfore max name length in SQLite
	if len(alertDefinition.Title) > alertDefinitionMaxTitleLength {
		return fmt.Errorf("name length should not be greater than %d", alertDefinitionMaxTitleLength)
	}

	if alertDefinition.OrgID == 0 {
		return fmt.Errorf("no organisation is found")
	}

	return nil
}

// validateCondition validates that condition queries refer to existing datasources
func (ng *AlertNG) validateCondition(c eval.Condition, user *models.SignedInUser, skipCache bool) error {
	var refID string

	if len(c.QueriesAndExpressions) == 0 {
		return nil
	}

	for _, query := range c.QueriesAndExpressions {
		if c.RefID == query.RefID {
			refID = c.RefID
		}

		datasourceUID, err := query.GetDatasource()
		if err != nil {
			return err
		}

		isExpression, err := query.IsExpression()
		if err != nil {
			return err
		}
		if isExpression {
			continue
		}

		_, err = ng.DatasourceCache.GetDatasourceByUID(datasourceUID, user, skipCache)
		if err != nil {
			return fmt.Errorf("failed to get datasource: %s: %w", datasourceUID, err)
		}
	}

	if refID == "" {
		return fmt.Errorf("condition %s not found in any query or expression", c.RefID)
	}
	return nil
}
