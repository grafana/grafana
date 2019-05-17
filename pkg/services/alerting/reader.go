package alerting

import (
	"sync"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
)

type ruleReader interface {
	fetch() []*Rule
}

type defaultRuleReader struct {
	sync.RWMutex
	log log.Logger
}

func newRuleReader() *defaultRuleReader {
	ruleReader := &defaultRuleReader{
		log: log.New("alerting.ruleReader"),
	}

	return ruleReader
}

func (arr *defaultRuleReader) fetch() []*Rule {
	cmd := &models.GetAllAlertsQuery{}

	if err := bus.Dispatch(cmd); err != nil {
		arr.log.Error("Could not load alerts", "error", err)
		return []*Rule{}
	}

	res := make([]*Rule, 0)
	for _, ruleDef := range cmd.Result {
		if model, err := NewRuleFromDBAlert(ruleDef); err != nil {
			arr.log.Error("Could not build alert model for rule", "ruleId", ruleDef.Id, "error", err)
		} else {
			res = append(res, model)
		}
	}

	metrics.M_Alerting_Active_Alerts.Set(float64(len(res)))
	return res
}
