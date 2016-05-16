package alerting

import (
	"time"

	m "github.com/grafana/grafana/pkg/models"
)

func Init() {
	go dispatcher()
}

func dispatcher() {

	ticker := time.NewTicker(time.Second)

	for {
		select {
		case <-ticker.C:
			scheduleJobs()
		}
	}
}

func scheduleJobs() {

}

type Scheduler interface {
}

type Executor interface {
	Execute(rule *m.AlertRule)
}
