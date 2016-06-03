package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
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
	reader := NewRuleReader()

	go scheduler.dispatch(reader)
	go scheduler.Executor(&ExecutorImpl{})
	go scheduler.HandleResponses()

}

type Scheduler struct {
	jobs          map[int64]*m.AlertJob
	runQueue      chan *m.AlertJob
	responseQueue chan *m.AlertResult

	alertRuleFetcher RuleReader
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		jobs:          make(map[int64]*m.AlertJob, 0),
		runQueue:      make(chan *m.AlertJob, 1000),
		responseQueue: make(chan *m.AlertResult, 1000),
	}
}

func (scheduler *Scheduler) dispatch(reader RuleReader) {
	reschedule := time.NewTicker(time.Second * 10)
	secondTicker := time.NewTicker(time.Second)

	scheduler.updateJobs(reader.Fetch)

	for {
		select {
		case <-secondTicker.C:
			scheduler.queueJobs()
		case <-reschedule.C:
			scheduler.updateJobs(reader.Fetch)
		}
	}
}

func (scheduler *Scheduler) updateJobs(alertRuleFn func() []m.AlertRule) {
	log.Debug("Scheduler: UpdateJobs()")

	jobs := make(map[int64]*m.AlertJob, 0)
	rules := alertRuleFn()

	for i := 0; i < len(rules); i++ {
		rule := rules[i]
		jobs[rule.Id] = &m.AlertJob{
			Rule:    rule,
			Offset:  int64(i),
			Running: false,
		}
	}

	log.Debug("Scheduler: Selected %d jobs", len(jobs))
	scheduler.jobs = jobs
}

func (scheduler *Scheduler) queueJobs() {
	now := time.Now().Unix()
	for _, job := range scheduler.jobs {
		if now%job.Rule.Frequency == 0 && job.Running == false {
			log.Info("Scheduler: Putting job on to run queue: %s", job.Rule.Title)
			scheduler.runQueue <- job
		}
	}
}

func (scheduler *Scheduler) Executor(executor Executor) {
	for job := range scheduler.runQueue {
		//log.Info("Executor: queue length %d", len(this.runQueue))
		log.Info("Executor: executing %s", job.Rule.Title)
		scheduler.jobs[job.Rule.Id].Running = true
		scheduler.MeasureAndExecute(executor, job)
	}
}

func (scheduler *Scheduler) HandleResponses() {
	for response := range scheduler.responseQueue {
		log.Info("Response: alert(%d) status(%s) actual(%v)", response.Id, response.State, response.ActualValue)
		if scheduler.jobs[response.Id] != nil {
			scheduler.jobs[response.Id].Running = false
		}

		cmd := m.UpdateAlertStateCommand{
			AlertId:  response.Id,
			NewState: response.State,
			Info:     response.Description,
		}

		if err := bus.Dispatch(&cmd); err != nil {
			log.Error(1, "failed to save state", err)
		}
	}
}

func (scheduler *Scheduler) MeasureAndExecute(exec Executor, job *m.AlertJob) {
	now := time.Now()

	responseChan := make(chan *m.AlertResult, 1)
	go exec.Execute(job, responseChan)

	select {
	case <-time.After(time.Second * 5):
		scheduler.responseQueue <- &m.AlertResult{
			Id:       job.Rule.Id,
			State:    "timed out",
			Duration: float64(time.Since(now).Nanoseconds()) / float64(1000000),
			Rule:     job.Rule,
		}
	case result := <-responseChan:
		result.Duration = float64(time.Since(now).Nanoseconds()) / float64(1000000)
		log.Info("Schedular: exeuction took %vms", result.Duration)
		scheduler.responseQueue <- result
	}
}
