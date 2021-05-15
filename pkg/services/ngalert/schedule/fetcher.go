package schedule

import (
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (sch *schedule) fetchAllDetails(now time.Time) []*models.AlertDefinition {
	q := models.ListAlertDefinitionsQuery{}
	err := sch.store.GetAlertDefinitions(&q)
	if err != nil {
		sch.log.Error("failed to fetch alert definitions", "now", now, "err", err)
		return nil
	}
	return q.Result
}
