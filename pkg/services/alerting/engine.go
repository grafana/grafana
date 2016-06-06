package alerting

import (
	"time"

	"github.com/Unknwon/log"
	"github.com/benbjohnson/clock"
)

type Engine struct {
	execQueue   chan *AlertJob
	resultQueue chan *AlertResult
	clock       clock.Clock
	ticker      *Ticker
	scheduler   Scheduler
}

func NewEngine() *Engine {
	e := &Engine{
		ticker:      NewTicker(time.Now(), time.Second*0, clock.New()),
		execQueue:   make(chan *AlertJob, 1000),
		resultQueue: make(chan *AlertResult, 1000),
		scheduler:   NewScheduler(),
	}

	return e
}

func (e *Engine) Start() {
	go e.schedulerTick()
	go e.execDispatch()
}

func (e *Engine) Stop() {
	close(e.execQueue)
}

func (e *Engine) schedulerTick() {
	for {
		select {
		case tick := <-e.ticker.C:
			e.scheduler.Tick(tick, e.execQueue)
		}
	}
}

func (e *Engine) execDispatch() {
	for job := range e.execQueue {
		log.Info("AlertEngine: Dispatching alert job %s", job.Rule.Title)
		job.Running = true
		//scheduler.measureAndExecute(executor, job)
	}
}
