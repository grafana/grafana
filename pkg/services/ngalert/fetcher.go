package ngalert

import (
	"time"
)

func (sch *schedule) fetchAllDetails(now time.Time) []*AlertDefinition {
	q := listAlertDefinitionsQuery{}
	err := sch.store.getAlertDefinitions(&q)
	if err != nil {
		sch.log.Error("failed to fetch alert definitions", "now", now, "err", err)
		return nil
	}
	return q.Result
}
