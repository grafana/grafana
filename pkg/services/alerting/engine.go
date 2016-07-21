package alerting

import (
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
	handler         AlertHandler
	ruleReader      RuleReader
	log             log.Logger
	responseHandler ResultHandler
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
	for job := range e.execQueue {
		e.log.Debug("Starting executing alert rule %s", job.Rule.Name)
		go e.executeJob(job)
	}
}

func (e *Engine) executeJob(job *AlertJob) {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Execute Alert Panic", "error", err, "stack", log.Stack(1))
		}
	}()

	job.Running = true
	context := NewAlertResultContext(job.Rule)
	e.handler.Execute(context)
	job.Running = false

	e.resultQueue <- context
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
