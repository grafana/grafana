package alerting

import (
	"math"
	"time"

	"github.com/grafana/grafana/pkg/log"
)

type SchedulerImpl struct {
	jobs map[int64]*Job
	log  log.Logger
}

func NewScheduler() Scheduler {
	return &SchedulerImpl{
		jobs: make(map[int64]*Job, 0),
		log:  log.New("alerting.scheduler"),
	}
}

func (s *SchedulerImpl) Update(rules []*Rule) {
	s.log.Debug("Scheduling update", "ruleCount", len(rules))

	jobs := make(map[int64]*Job, 0)

	for i, rule := range rules {
		var job *Job
		if s.jobs[rule.Id] != nil {
			job = s.jobs[rule.Id]
		} else {
			job = &Job{
				Running: false,
			}
		}

		job.Rule = rule
		job.Offset = ((rule.Frequency * 1000) / int64(len(rules))) * int64(i)
		job.Offset = int64(math.Floor(float64(job.Offset) / 1000))
		jobs[rule.Id] = job
	}

	s.jobs = jobs
}

func (s *SchedulerImpl) Tick(tickTime time.Time, execQueue chan *Job) {
	now := tickTime.Unix()

	for _, job := range s.jobs {
		if job.Running {
			continue
		}

		if job.OffsetWait && now%job.Offset == 0 {
			job.OffsetWait = false
			s.enque(job, execQueue)
			continue
		}

		if now%job.Rule.Frequency == 0 {
			if job.Offset > 0 {
				job.OffsetWait = true
			} else {
				s.enque(job, execQueue)
			}
		}
	}
}

func (s *SchedulerImpl) enque(job *Job, execQueue chan *Job) {
	s.log.Debug("Scheduler: Putting job on to exec queue", "name", job.Rule.Name, "id", job.Rule.Id)
	execQueue <- job
}
