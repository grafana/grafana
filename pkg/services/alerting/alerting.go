package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	maxRetries = 3
)

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	log.Info("Alerting: Initializing scheduler...")

	scheduler := NewScheduler()
	reader := NewRuleReader()

	go scheduler.dispatch(reader)
	go scheduler.executor(&ExecutorImpl{})
	go scheduler.handleResponses()
}

func saveState(response *AlertResult) {
	cmd := &m.UpdateAlertStateCommand{
		AlertId:  response.Id,
		NewState: response.State,
		Info:     response.Description,
	}

	if err := bus.Dispatch(cmd); err != nil {
		log.Error(2, "failed to save state %v", err)
	}
}
