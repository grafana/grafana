package alerting

import (
	"time"

	"fmt"
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

	go scheduler.Dispatch(reader)
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

func (this *Scheduler) Dispatch(reader RuleReader) {
	reschedule := time.NewTicker(time.Second * 10)
	secondTicker := time.NewTicker(time.Second)

	this.updateJobs(reader.Fetch)

	for {
		select {
		case <-secondTicker.C:
			this.queueJobs()
		case <-reschedule.C:
			this.updateJobs(reader.Fetch)
		}
	}
}

func (this *Scheduler) updateJobs(f func() []m.AlertJob) {
	log.Debug("Scheduler: UpdateJobs()")

	jobs := make(map[int64]*m.AlertJob, 0)
	rules := f()

	for i := 0; i < len(rules); i++ {
		rule := rules[i]
		rule.Offset = int64(i)
		jobs[rule.Rule.Id] = &rule
	}

	log.Debug("Scheduler: Selected %d jobs", len(jobs))
	this.jobs = jobs
}

func (this *Scheduler) queueJobs() {
	now := time.Now().Unix()
	for _, job := range this.jobs {
		if now%job.Rule.Frequency == 0 && job.Running == false {
			log.Info("Scheduler: Putting job on to run queue: %s", job.Rule.Title)
			this.runQueue <- job
		}
	}
}

func (this *Scheduler) Executor(executor Executor) {
	for job := range this.runQueue {
		//log.Info("Executor: queue length %d", len(this.runQueue))
		log.Info("Executor: executing %s", job.Rule.Title)
		this.jobs[job.Rule.Id].Running = true
		this.MeasureAndExecute(executor, job)
	}
}

func (this *Scheduler) HandleResponses() {
	for response := range this.responseQueue {
		log.Info("Response: alert(%d) status(%s) actual(%v)", response.Id, response.State, response.ActualValue)
		if this.jobs[response.Id] != nil {
			this.jobs[response.Id].Running = false
		}

		cmd := m.UpdateAlertStateCommand{
			AlertId:  response.Id,
			NewState: response.State,
		}

		if cmd.NewState != m.AlertStateOk {
			cmd.Info = fmt.Sprintf("Actual value: %1.2f", response.ActualValue)
		}

		if err := bus.Dispatch(&cmd); err != nil {
			log.Error(1, "failed to save state", err)
		}
	}
}

func (this *Scheduler) MeasureAndExecute(exec Executor, job *m.AlertJob) {
	now := time.Now()

	responseChan := make(chan *m.AlertResult, 1)
	go exec.Execute(job, responseChan)

	select {
	case <-time.After(time.Second * 5):
		this.responseQueue <- &m.AlertResult{
			Id:       job.Rule.Id,
			State:    "timed out",
			Duration: float64(time.Since(now).Nanoseconds()) / float64(1000000),
			Rule:     job.Rule,
		}
	case result := <-responseChan:
		result.Duration = float64(time.Since(now).Nanoseconds()) / float64(1000000)
		log.Info("Schedular: exeuction took %vms", result.Duration)
		this.responseQueue <- result
	}
}
