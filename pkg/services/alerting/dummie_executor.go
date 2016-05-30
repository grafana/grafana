package alerting

import (
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

type DummieExecutor struct{}

func (this *DummieExecutor) Execute(rule m.AlertRule, responseQueue chan *m.AlertResult) {
	if rule.Id%3 == 0 {
		time.Sleep(time.Second * 1)
	}

	time.Sleep(time.Second)
	log.Info("Finnished executing: %d", rule.Id)

	responseQueue <- &m.AlertResult{State: "OK", Id: rule.Id}
}
