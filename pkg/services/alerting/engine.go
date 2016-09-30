package alerting

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
	"golang.org/x/sync/errgroup"
)

type Engine struct {
	execQueue     chan *Job
	resultQueue   chan *EvalContext
	clock         clock.Clock
	ticker        *Ticker
	scheduler     Scheduler
	evalHandler   EvalHandler
	ruleReader    RuleReader
	log           log.Logger
	resultHandler ResultHandler
}

func NewEngine() *Engine {
	e := &Engine{
		ticker:        NewTicker(time.Now(), time.Second*0, clock.New()),
		execQueue:     make(chan *Job, 1000),
		resultQueue:   make(chan *EvalContext, 1000),
		scheduler:     NewScheduler(),
		evalHandler:   NewEvalHandler(),
		ruleReader:    NewRuleReader(),
		log:           log.New("alerting.engine"),
		resultHandler: NewResultHandler(),
	}

	return e
}

func (e *Engine) Run(ctx context.Context) error {
	e.log.Info("Initializing Alerting")

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error { return e.alertingTicker(ctx) })
	g.Go(func() error { return e.runJobDispatcher(ctx) })

	err := g.Wait()

	e.log.Info("Stopped Alerting", "reason", err)
	return err
}

func (e *Engine) alertingTicker(grafanaCtx context.Context) error {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Scheduler Panic: stopping alertingTicker", "error", err, "stack", log.Stack(1))
		}
	}()

	tickIndex := 0

	for {
		select {
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
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

func (e *Engine) runJobDispatcher(grafanaCtx context.Context) error {
	for {
		select {
		case <-grafanaCtx.Done():
			close(e.resultQueue)
			return grafanaCtx.Err()
		case job := <-e.execQueue:
			go e.processJob(grafanaCtx, job)
		}
	}
}

func (e *Engine) processJob(grafanaCtx context.Context, job *Job) error {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
		}
	}()

	done := make(chan struct{})
	job.Running = true
	evalContext := NewEvalContext(grafanaCtx, job.Rule)

	go func() {
		e.evalHandler.Eval(evalContext)
		e.resultHandler.Handle(evalContext.Context, evalContext)
		e.log.Debug("Job Execution completed", "timeMs", evalContext.GetDurationMs(), "alertId", evalContext.Rule.Id, "name", evalContext.Rule.Name, "firing", evalContext.Firing)
		close(done)
	}()

	var err error = nil
	select {
	case <-grafanaCtx.Done():
		job.Running = false
		err = grafanaCtx.Err()
	case <-done:

	}
	job.Running = false
	return err
}
