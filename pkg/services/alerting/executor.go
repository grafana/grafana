package alerting

import (
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

type Executor interface {
	Execute(rule m.AlertRule) (err error, result AlertResult)
}

type DummieExecutor struct{}

func (this DummieExecutor) Execute(rule m.AlertRule) (err error, result AlertResult) {
	if rule.Id == 6 {
		time.Sleep(time.Second * 60)
	}
	time.Sleep(time.Second)
	log.Info("Finnished executing: %d", rule.Id)
	return nil, AlertResult{state: "OK", id: rule.Id}
}
