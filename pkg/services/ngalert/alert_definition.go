package ngalert

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

// GetEvalCondition returns a condition suitable for execution
// based on the saved AlertDefinition.
func (alertDefinition *AlertDefinition) GetEvalCondition(now time.Time) (*eval.Condition, error) {
	condition := &eval.Condition{
		RefID: alertDefinition.Condition,
	}
	for _, aq := range alertDefinition.Data {
		// GEL requires it (fails with InvalidArgument desc = no orgId in gel command for refId if not set)
		// this should be the organization with which the alert definition is created
		// or organisation of the signed in user???
		err := aq.setOrgID(alertDefinition.OrgId)
		if err != nil {
			return nil, fmt.Errorf("failed to set orgId query model: %w", err)
		}

		model, err := aq.getModel()
		if err != nil {
			return nil, fmt.Errorf("failed to get query model: %w", err)
		}

		intervalMS, err := aq.getIntervalMS()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve intervalMs from the model: %w", err)
		}

		maxDatapoints, err := aq.getMaxDatapoints()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve maxDatapoints from the model: %w", err)
		}

		err = aq.setQueryType()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve queryType from the model: %w", err)
		}

		condition.QueriesAndExpressions = append(condition.QueriesAndExpressions, backend.DataQuery{
			JSON:          model,
			Interval:      time.Duration(intervalMS) * time.Millisecond,
			RefID:         aq.RefID,
			MaxDataPoints: maxDatapoints,
			QueryType:     aq.QueryType,
			TimeRange:     aq.RelativeTimeRange.toTimeRange(now),
		})
	}
	return condition, nil
}

// preSave sets datasource and loads the updated model for each alert query.
func (alertDefinition *AlertDefinition) preSave() error {
	for i, q := range alertDefinition.Data {
		if err := q.setDatasource(); err != nil {
			return err
		}

		if err := q.setQueryType(); err != nil {
			return err
		}

		// override model
		model, err := q.getModel()
		if err != nil {
			return err
		}
		q.Model = model
		alertDefinition.Data[i] = q
	}
	return nil
}
