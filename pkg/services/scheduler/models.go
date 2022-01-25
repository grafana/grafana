package scheduler

import (
	"github.com/robfig/cron/v3"
	"time"
)

// JobName has to be unique
type JobName string

const (
	TestJob JobName = "test_job"
)

type Job interface {
	Run() error
}

type ScheduleRequest struct {
	Name     JobName
	Job      Job
	Schedule Schedule
	// options:
	//  retries: int
	//  retryOpts: either 'interval' or 'base & multiplier' for exponential backoff
	//  jobTimeout: time.Duration
	//  retryOnTimeout: boolean
	//  maxConcurrency: int
}

type Schedule struct {
	cron           string
	parsedSchedule cron.Schedule
}

type ScheduleId string

type schedulingStrategy interface {
	Schedule(req ScheduleRequest) (ScheduleId, error)
}

type Service interface {
	schedulingStrategy
	ParseCron(maybeCron string) (Schedule, error)
}

func (s Schedule) nextInvocation() time.Time {
	return s.parsedSchedule.Next(time.Now())
}
