package alerting

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	maxRetries = 3
)

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	log.Info("Alerting: Initializing scheduler...")

	scheduler := NewScheduler()
	reader := NewRuleReader()

	go scheduler.dispatch(reader)
	go scheduler.executor(&ExecutorImpl{})
	go scheduler.handleResponses()

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

	for i, rule := range rules {
		var job *m.AlertJob
		if scheduler.jobs[rule.Id] != nil {
			job = scheduler.jobs[rule.Id]
		} else {
			job = &m.AlertJob{
				Running: false,
				Retry:   0,
			}
		}

		job.Rule = rule
		job.Offset = int64(i)

		jobs[rule.Id] = job
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

func (scheduler *Scheduler) executor(executor Executor) {
	for job := range scheduler.runQueue {
		//log.Info("Executor: queue length %d", len(this.runQueue))
		log.Info("Executor: executing %s", job.Rule.Title)
		job.Running = true
		scheduler.measureAndExecute(executor, job)
	}
}

func (scheduler *Scheduler) handleResponses() {
	for response := range scheduler.responseQueue {
		log.Info("Response: alert(%d) status(%s) actual(%v) retry(%d) running(%v)", response.Id, response.State, response.ActualValue, response.AlertJob.Retry, response.AlertJob.Running)
		response.AlertJob.Running = false

		if response.State == m.AlertStatePending {
			response.AlertJob.Retry++
			if response.AlertJob.Retry > maxRetries {
				response.State = m.AlertStateCritical
				response.Description = fmt.Sprintf("Failed to run check after %d retires", maxRetries)
				scheduler.saveState(response)
			}
		} else {
			response.AlertJob.Retry = 0
			scheduler.saveState(response)
		}
	}
}

func (scheduler *Scheduler) saveState(response *m.AlertResult) {
	cmd := &m.UpdateAlertStateCommand{
		AlertId:  response.Id,
		NewState: response.State,
		Info:     response.Description,
	}

	if err := bus.Dispatch(cmd); err != nil {
		log.Error(2, "failed to save state %v", err)
	}
}

func (scheduler *Scheduler) measureAndExecute(exec Executor, job *m.AlertJob) {
	now := time.Now()

	responseChan := make(chan *m.AlertResult, 1)
	go exec.Execute(job, responseChan)

	select {
	case <-time.After(time.Second * 5):
		scheduler.responseQueue <- &m.AlertResult{
			Id:       job.Rule.Id,
			State:    m.AlertStatePending,
			Duration: float64(time.Since(now).Nanoseconds()) / float64(1000000),
			AlertJob: job,
		}
	case result := <-responseChan:
		result.Duration = float64(time.Since(now).Nanoseconds()) / float64(1000000)
		log.Info("Schedular: exeuction took %vms", result.Duration)
		scheduler.responseQueue <- result
	}
}
