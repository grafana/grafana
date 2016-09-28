//"I want to be a cleaner, just like you," said Mathilda
//"Okay," replied Leon

package backgroundtasks

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

var (
	tlog log.Logger = log.New("ticker")
)

func Init() {
	go start()
}

func start() {
	go cleanup(time.Now())

	ticker := time.NewTicker(time.Hour * 1)
	for {
		select {
		case tick := <-ticker.C:
			go cleanup(tick)
		}
	}
}

func cleanup(now time.Time) {
	err := bus.Publish(&models.HourCommand{Time: now})
	if err != nil {
		tlog.Error("Cleanup job failed", "error", err)
	}
}
