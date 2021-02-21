package ngalert

import (
	"time"
)

func (ng *AlertNG) fetchAllDetails(now time.Time) []*AlertDefinition {
	q := listAlertDefinitionsQuery{}
	err := ng.getAlertDefinitions(&q)
	if err != nil {
		ng.schedule.log.Error("failed to fetch alert definitions", "now", now, "err", err)
		return nil
	}
	return q.Result
}
