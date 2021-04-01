package schedule

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (sch *schedule) fetchAllDetails() []*models.AlertDefinition {
	q := models.ListAlertDefinitionsQuery{}
	err := sch.store.GetAlertDefinitions(&q)
	if err != nil {
		sch.log.Error("failed to fetch alert definitions", "err", err)
		return nil
	}
	return q.Result
}
