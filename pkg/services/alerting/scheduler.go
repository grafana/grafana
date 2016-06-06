package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/log"
)

type SchedulerImpl struct {
	jobs map[int64]*AlertJob
}

func NewScheduler() Scheduler {
	return &SchedulerImpl{
		jobs: make(map[int64]*AlertJob, 0),
	}
}

func (scheduler *SchedulerImpl) Update(rules []*AlertRule) {
	log.Debug("Scheduler: Update()")

	jobs := make(map[int64]*AlertJob, 0)

	for i, rule := range rules {
		var job *AlertJob
		if scheduler.jobs[rule.Id] != nil {
			job = scheduler.jobs[rule.Id]
		} else {
			job = &AlertJob{
				Running:    false,
				RetryCount: 0,
			}
		}

		job.Rule = rule
		job.Offset = int64(i)

		jobs[rule.Id] = job
	}

	log.Debug("Scheduler: Selected %d jobs", len(jobs))
	scheduler.jobs = jobs
}

func (scheduler *SchedulerImpl) Tick(tickTime time.Time, execQueue chan *AlertJob) {
	now := tickTime.Unix()

	for _, job := range scheduler.jobs {
		if now%job.Rule.Frequency == 0 && job.Running == false {
			log.Trace("Scheduler: Putting job on to exec queue: %s", job.Rule.Title)
			execQueue <- job
		}
	}
}

// func (scheduler *Scheduler) handleResponses() {
// 	for response := range scheduler.responseQueue {
// 		log.Info("Response: alert(%d) status(%s) actual(%v) retry(%d)", response.Id, response.State, response.ActualValue, response.AlertJob.RetryCount)
// 		response.AlertJob.Running = false
//
// 		if response.IsResultIncomplete() {
// 			response.AlertJob.RetryCount++
// 			if response.AlertJob.RetryCount < maxRetries {
// 				scheduler.runQueue <- response.AlertJob
// 			} else {
// 				saveState(&AlertResult{
// 					Id:          response.Id,
// 					State:       alertstates.Critical,
// 					Description: fmt.Sprintf("Failed to run check after %d retires", maxRetries),
// 				})
// 			}
// 		} else {
// 			response.AlertJob.RetryCount = 0
// 			saveState(response)
// 		}
// 	}
// }
//
// func (scheduler *Scheduler) measureAndExecute(exec Executor, job *AlertJob) {
// 	now := time.Now()
//
// 	responseChan := make(chan *AlertResult, 1)
// 	go exec.Execute(job, responseChan)
//
// 	select {
// 	case <-time.After(time.Second * 5):
// 		scheduler.responseQueue <- &AlertResult{
// 			Id:       job.Rule.Id,
// 			State:    alertstates.Pending,
// 			Duration: float64(time.Since(now).Nanoseconds()) / float64(1000000),
// 			AlertJob: job,
// 		}
// 	case result := <-responseChan:
// 		result.Duration = float64(time.Since(now).Nanoseconds()) / float64(1000000)
// 		log.Info("Schedular: exeuction took %vms", result.Duration)
// 		scheduler.responseQueue <- result
// 	}
// }
