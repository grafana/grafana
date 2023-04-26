package alerting

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/alerting/models"
)

type ruleReader interface {
	fetch(context.Context) []*Rule
}

type defaultRuleReader struct {
	sync.RWMutex
	sqlStore AlertStore
	log      log.Logger
}

func newRuleReader(sqlStore AlertStore) *defaultRuleReader {
	ruleReader := &defaultRuleReader{
		sqlStore: sqlStore,
		log:      log.New("alerting.ruleReader"),
	}

	return ruleReader
}

func (arr *defaultRuleReader) fetch(ctx context.Context) []*Rule {
	cmd := &models.GetAllAlertsQuery{}

	alerts, err := arr.sqlStore.GetAllAlertQueryHandler(ctx, cmd)
	if err != nil {
		arr.log.Error("Could not load alerts", "error", err)
		return []*Rule{}
	}

	res := make([]*Rule, 0)
	for _, ruleDef := range alerts {
		if model, err := NewRuleFromDBAlert(ctx, arr.sqlStore, ruleDef, false); err != nil {
			arr.log.Error("Could not build alert model for rule", "ruleId", ruleDef.ID, "error", err)
		} else {
			res = append(res, model)
		}
	}

	metrics.MAlertingActiveAlerts.Set(float64(len(res)))
	return res
}
