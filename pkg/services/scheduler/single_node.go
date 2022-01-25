package scheduler

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/robfig/cron/v3"
	"strconv"
)

var (
	nlog log.Logger = log.New("single_node_scheduler")
)

type singleNodeScheduler struct {
	cronRunner *cron.Cron
}

func (s *singleNodeScheduler) Schedule(request ScheduleRequest) (ScheduleId, error) {
	firstInvocation := request.Schedule.nextInvocation()
	jobWrapper := &jobWrapper{job: request.Job, request: request}
	entryId := s.cronRunner.Schedule(request.Schedule.parsedSchedule, jobWrapper)

	scheduleId := ScheduleId(strconv.Itoa(int(entryId)))
	jobWrapper.scheduleId = scheduleId

	nlog.Info("Scheduled a job", "name", request.Name, "scheduleId", scheduleId, "firstInvocation", firstInvocation.String(), "cron", request.Schedule.cron)

	return scheduleId, nil
}

type jobWrapper struct {
	job        Job
	request    ScheduleRequest
	scheduleId ScheduleId
}

func (j *jobWrapper) Run() {
	err := j.job.Run()
	if err != nil {
		nlog.Error("Job error", "name", j.request.Name, "scheduleId", j.scheduleId, "nextInvocation", j.request.Schedule.nextInvocation(), "cron", j.request.Schedule.cron, "error", err.Error())
	}
}
