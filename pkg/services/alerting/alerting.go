package alerting

import (
	"math/rand"
	"strconv"
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
	go scheduler.Dispatch(&AlertRuleReader{})
	go scheduler.Executor(&DummieExecutor{})
}

type Scheduler struct {
	jobs     []*AlertJob
	runQueue chan *AlertJob

	alertRuleFetcher RuleReader

	serverId       string
	serverPosition int
	clusterSize    int
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		jobs:     make([]*AlertJob, 0),
		runQueue: make(chan *AlertJob, 1000),
		serverId: strconv.Itoa(rand.Intn(1000)),
	}
}

func (s *Scheduler) heartBeat() {
	//write heartBeat to db.
	//get the modulus position of active servers

	log.Info("Heartbeat: Sending heartbeat from " + s.serverId)
	s.clusterSize = 1
	s.serverPosition = 1
}

func (s *Scheduler) Dispatch(reader RuleReader) {
	reschedule := time.NewTicker(time.Second * 10)
	secondTicker := time.NewTicker(time.Second)
	heartbeat := time.NewTicker(time.Second * 5)

	s.heartBeat()
	s.updateJobs(reader.Fetch)

	for {
		select {
		case <-secondTicker.C:
			s.queueJobs()
		case <-reschedule.C:
			s.updateJobs(reader.Fetch)
		case <-heartbeat.C:
			s.heartBeat()
		}
	}
}

func (s *Scheduler) updateJobs(f func() []m.AlertRule) {
	log.Debug("Scheduler: UpdateJobs()")

	jobs := make([]*AlertJob, 0)
	rules := f()

	for i := s.serverPosition - 1; i < len(rules); i += s.clusterSize {
		rule := rules[i]
		jobs = append(jobs, &AlertJob{
			id:        rule.Id,
			name:      rule.Title,
			frequency: rule.Frequency,
			rule:      rule,
			offset:    int64(len(jobs)),
		})
	}

	log.Debug("Scheduler: Selected %d jobs", len(jobs))

	s.jobs = jobs
}

func (s *Scheduler) queueJobs() {
	now := time.Now().Unix()

	for _, job := range s.jobs {
		if now%job.frequency == 0 {
			log.Info("Scheduler: Putting job on to run queue: %s", job.name)
			s.runQueue <- job
		}
	}
}

func (s *Scheduler) Executor(executor Executor) {
	for job := range s.runQueue {
		log.Info("Executor: queue length %d", len(s.runQueue))
		log.Info("Executor: executing %s", job.name)
		go executor.Execute(job.rule)
	}
}

type AlertJob struct {
	id        int64
	name      string
	frequency int64
	offset    int64
	delay     bool
	rule      m.AlertRule
}

type AlertResult struct {
	id       int64
	state    string
	duration time.Time
}
