package scheduler

import (
	"errors"
	"github.com/grafana/grafana/pkg/infra/log"
)

var (
	dlog log.Logger = log.New("distributed_scheduler")
)

// candidate libraries:
//   - https://pkg.go.dev/github.com/hibiken/asynq
//   - https://github.com/ajvb/kala
//   - https://github.com/distribworks/dkron
//   - https://github.com/ehsaniara/gointerlock

type distributedScheduler struct {
}

func (s *distributedScheduler) Schedule(request ScheduleRequest) (ScheduleId, error) {
	errorMessage := "distributed scheduler has not been implemented yet"
	dlog.Error(errorMessage)
	return "", errors.New(errorMessage)
}
