package alerting

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

func LoadOrSetOffset() int {
	query := m.GetAlertSchedulerValueQuery{
		Id: "offset",
	}
	err := bus.Dispatch(&query)
	if err != nil {
		panic(fmt.Sprintf("failure querying for current offset: %q", err))
	}
	if query.Result == "" {
		log.Debug("initializing offset to default value of 30 seconds.")
		setOffset(30)
		return 30
	}
	i, err := strconv.Atoi(query.Result)
	if err != nil {
		panic(fmt.Sprintf("failure reading in offset: %q. input value was: %q", err, query.Result))
	}
	return i
}

func setOffset(offset int) {
	update := m.UpdateAlertSchedulerValueCommand{
		Id:    "offset",
		Value: fmt.Sprintf("%d", offset),
	}
	err := bus.Dispatch(&update)
	if err != nil {
		log.Error(0, "Could not persist offset: %q", err)
	}
}
