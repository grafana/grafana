package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	log.Info("Alerting: Initializing scheduler...")

	scheduler := NewScheduler()
	go scheduler.Dispatch()
	go scheduler.Executor()
}

type Scheduler struct {
	jobs     []*AlertJob
	runQueue chan *AlertJob
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		jobs:     make([]*AlertJob, 0),
		runQueue: make(chan *AlertJob, 1000),
	}
}

func (s *Scheduler) Dispatch() {
	reschedule := time.NewTicker(time.Second * 10)
	secondTicker := time.NewTicker(time.Second)

	s.updateJobs()

	for {
		select {
		case <-secondTicker.C:
			s.queueJobs()
		case <-reschedule.C:
			s.updateJobs()
		}
	}
}

func (s *Scheduler) updateJobs() {
	log.Info("Scheduler:updateJobs()")

	jobs := make([]*AlertJob, 0)
	jobs = append(jobs, &AlertJob{
		name:      "ID_1_Each 10s",
		frequency: 10,
		offset:    1,
	})
	jobs = append(jobs, &AlertJob{
		name:      "ID_2_Each 10s",
		frequency: 10,
		offset:    2,
	})
	jobs = append(jobs, &AlertJob{
		name:      "ID_3_Each 10s",
		frequency: 10,
		offset:    3,
	})

	jobs = append(jobs, &AlertJob{
		name:      "ID_4_Each 5s",
		frequency: 5,
	})

	s.jobs = jobs
}

func (s *Scheduler) queueJobs() {
	log.Info("Scheduler:queueJobs()")

	now := time.Now().Unix()

	for _, job := range s.jobs {
		if now%job.frequency == 0 {
			log.Info("Scheduler: Putting job on to run queue: %s", job.name)
			s.runQueue <- job
		}
	}
}

func (s *Scheduler) Executor() {

	for job := range s.runQueue {
		log.Info("Executor: queue length %d", len(s.runQueue))
		log.Info("Executor: executing %s", job.name)
		time.Sleep(1000)
	}
}

type AlertJob struct {
	id        int64
	name      string
	frequency int64
	offset    int64
	delay     bool
}

type RuleReader interface {
}

type Executor interface {
	Execute(rule *m.AlertRule)
}
