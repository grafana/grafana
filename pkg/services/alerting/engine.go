package alerting

import (
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
)

type Engine struct {
	execQueue       chan *AlertJob
	resultQueue     chan *AlertResultContext
	clock           clock.Clock
	ticker          *Ticker
	scheduler       Scheduler
	handler         AlertingHandler
	ruleReader      RuleReader
	log             log.Logger
	responseHandler ResultHandler
	alertJobTimeout time.Duration
}

func NewEngine() *Engine {
	e := &Engine{
		ticker:          NewTicker(time.Now(), time.Second*0, clock.New()),
		execQueue:       make(chan *AlertJob, 1000),
		resultQueue:     make(chan *AlertResultContext, 1000),
		scheduler:       NewScheduler(),
		handler:         NewHandler(),
		ruleReader:      NewRuleReader(),
		log:             log.New("alerting.engine"),
		responseHandler: NewResultHandler(),
		alertJobTimeout: time.Second * 5,
	}

	return e
}

func (e *Engine) Start() {
	e.log.Info("Starting Alerting Engine")

	go e.alertingTicker()
	go e.execDispatch()
	go e.resultHandler()
}

func (e *Engine) Stop() {
	close(e.execQueue)
	close(e.resultQueue)
}

func (e *Engine) alertingTicker() {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Scheduler Panic: stopping alertingTicker", "error", err, "stack", log.Stack(1))
		}
	}()

	tickIndex := 0

	for {
		select {
		case tick := <-e.ticker.C:
			// TEMP SOLUTION update rules ever tenth tick
			if tickIndex%10 == 0 {
				e.scheduler.Update(e.ruleReader.Fetch())
			}

			e.scheduler.Tick(tick, e.execQueue)
			tickIndex++
		}
	}
}

func (e *Engine) execDispatch() {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Scheduler Panic: stopping executor", "error", err, "stack", log.Stack(1))
		}
	}()

	for job := range e.execQueue {
		log.Trace("Alerting: engine:execDispatch() starting job %s", job.Rule.Name)
		job.Running = true
		e.executeJob(job)
	}
}

func (e *Engine) executeJob(job *AlertJob) {
	startTime := time.Now()

	resultChan := make(chan *AlertResultContext, 1)
	go e.handler.Execute(job.Rule, resultChan)

	select {
	case <-time.After(e.alertJobTimeout):
		e.resultQueue <- &AlertResultContext{
			Error:     fmt.Errorf("Timeout"),
			Rule:      job.Rule,
			StartTime: startTime,
			EndTime:   time.Now(),
		}
		close(resultChan)
		e.log.Debug("Job Execution timeout", "alertRuleId", job.Rule.Id)
	case result := <-resultChan:
		duration := float64(result.EndTime.Nanosecond()-result.StartTime.Nanosecond()) / float64(1000000)
		e.log.Debug("Job Execution done", "timeTakenMs", duration, "ruleId", job.Rule.Id)
		e.resultQueue <- result
	}

	job.Running = false
}

func (e *Engine) resultHandler() {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Engine Panic, stopping resultHandler", "error", err, "stack", log.Stack(1))
		}
	}()

	for result := range e.resultQueue {
		e.log.Debug("Alert Rule Result", "ruleId", result.Rule.Id, "triggered", result.Triggered)

		if result.Error != nil {
			e.log.Error("Alert Rule Result Error", "ruleId", result.Rule.Id, "error", result.Error, "retry")
		} else {
			e.responseHandler.Handle(result)
		}
	}
}
