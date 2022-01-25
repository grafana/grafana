package scheduler

import (
	"github.com/grafana/grafana/pkg/setting"
	"github.com/robfig/cron/v3"
)

type service struct {
	cronParser cron.Parser
	strategy   schedulingStrategy
}

func ProvideService(cfg *setting.Cfg) Service {

	var strategy schedulingStrategy
	if !cfg.IsSchedulerServiceEnabled() {
		strategy = &dummyScheduler{}
	} else if cfg.IsDistributedSchedulerServiceEnabled() {
		strategy = &distributedScheduler{}
	} else {
		cronRunner := cron.New()
		cronRunner.Start()
		strategy = &singleNodeScheduler{cronRunner: cronRunner}
	}

	return &service{
		cronParser: cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow),
		strategy:   strategy,
	}
}

func (s *service) Schedule(request ScheduleRequest) (ScheduleId, error) {

	// TODO: if(jobEnabled(request.name)) {
	return s.strategy.Schedule(request)
}

func (s *service) ParseCron(maybeCron string) (Schedule, error) {
	res, err := s.cronParser.Parse(maybeCron)

	if err != nil {
		return Schedule{}, err
	}

	return Schedule{
		parsedSchedule: res,
		cron:           maybeCron,
	}, nil
}
