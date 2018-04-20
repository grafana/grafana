package alerting

import (
	"math"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

type SchedulerImpl struct {
	jobs map[int64]*Job
	log  log.Logger
}

func NewScheduler() Scheduler {
	return &SchedulerImpl{
		jobs: make(map[int64]*Job),
		log:  log.New("alerting.scheduler"),
	}
}

func (s *SchedulerImpl) Update(rules []*Rule) {
	s.log.Debug("Scheduling update", "ruleCount", len(rules))

	jobs := make(map[int64]*Job)

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

		offset := ((rule.Frequency * 1000) / int64(len(rules))) * int64(i)
		job.Offset = int64(math.Floor(float64(offset) / 1000))
		if job.Offset == 0 { //zero offset causes division with 0 panics.
			job.Offset = 1
		}
		jobs[rule.Id] = job
	}

	s.jobs = jobs
}

func (s *SchedulerImpl) Tick(tickTime time.Time, execQueue chan *Job) {
	now := tickTime.Unix()

	for _, job := range s.jobs {
		if job.Running || job.Rule.State == models.AlertStatePaused {
			continue
		}

		if job.OffsetWait && now%job.Offset == 0 {
			job.OffsetWait = false
			s.enqueue(job, execQueue)
			continue
		}

		if now%job.Rule.Frequency == 0 {
			if job.Offset > 0 {
				job.OffsetWait = true
			} else {
				s.enqueue(job, execQueue)
			}
		}
	}
}

func (s *SchedulerImpl) enqueue(job *Job, execQueue chan *Job) {
	s.log.Debug("Scheduler: Putting job on to exec queue", "name", job.Rule.Name, "id", job.Rule.Id)
	execQueue <- job
}
