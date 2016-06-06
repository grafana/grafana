package alerting

import (
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
)

type Engine struct {
	execQueue   chan *AlertJob
	resultQueue chan *AlertResult
	clock       clock.Clock
	ticker      *Ticker
	scheduler   Scheduler
	executor    Executor
	ruleReader  RuleReader
}

func NewEngine() *Engine {
	e := &Engine{
		ticker:      NewTicker(time.Now(), time.Second*0, clock.New()),
		execQueue:   make(chan *AlertJob, 1000),
		resultQueue: make(chan *AlertResult, 1000),
		scheduler:   NewScheduler(),
		executor:    &ExecutorImpl{},
		ruleReader:  NewRuleReader(),
	}

	return e
}

func (e *Engine) Start() {
	log.Info("Alerting: Engine.Start()")

	go e.schedulerTick()
	go e.execDispatch()
	go e.resultHandler()
}

func (e *Engine) Stop() {
	close(e.execQueue)
	close(e.resultQueue)
}

func (e *Engine) schedulerTick() {
	tickIndex := 0

	for {
		select {
		case tick := <-e.ticker.C:
			// update rules ever tenth tick
			if tickIndex%10 == 0 {
				e.scheduler.Update(e.ruleReader.Fetch())
			}

			e.scheduler.Tick(tick, e.execQueue)
		}
	}
}

func (e *Engine) execDispatch() {
	for job := range e.execQueue {
		log.Trace("Alerting: Engine:execDispatch() starting job %s", job.Rule.Title)
		job.Running = true
		e.executeJob(job)
	}
}

func (e *Engine) executeJob(job *AlertJob) {
	now := time.Now()

	resultChan := make(chan *AlertResult, 1)
	go e.executor.Execute(job, resultChan)

	select {
	case <-time.After(time.Second * 5):
		e.resultQueue <- &AlertResult{
			Id:       job.Rule.Id,
			State:    alertstates.Pending,
			Duration: float64(time.Since(now).Nanoseconds()) / float64(1000000),
			AlertJob: job,
		}
	case result := <-resultChan:
		result.Duration = float64(time.Since(now).Nanoseconds()) / float64(1000000)
		log.Trace("Alerting: engine.executeJob(): exeuction took %vms", result.Duration)
		e.resultQueue <- result
	}
}

func (e *Engine) resultHandler() {
	for result := range e.resultQueue {
		log.Debug("Alerting: engine.resultHandler(): alert(%d) status(%s) actual(%v) retry(%d)", result.Id, result.State, result.ActualValue, result.AlertJob.RetryCount)
		result.AlertJob.Running = false

		if result.IsResultIncomplete() {
			result.AlertJob.RetryCount++
			if result.AlertJob.RetryCount < maxRetries {
				e.execQueue <- result.AlertJob
			} else {
				saveState(&AlertResult{
					Id:          result.Id,
					State:       alertstates.Critical,
					Description: fmt.Sprintf("Failed to run check after %d retires", maxRetries),
				})
			}
		} else {
			result.AlertJob.RetryCount = 0
			saveState(result)
		}
	}
}
