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
	g.Go(func() error { return e.execDispatcher(ctx) })
	g.Go(func() error { return e.resultDispatcher(ctx) })

	err := g.Wait()

	e.log.Info("Stopped Alerting", "reason", err)
	return err
}

func (e *Engine) Stop() {
	close(e.execQueue)
	close(e.resultQueue)
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

func (e *Engine) execDispatcher(grafanaCtx context.Context) error {
	for {
		select {
		case <-grafanaCtx.Done():
			close(e.resultQueue)
			return grafanaCtx.Err()
		case job := <-e.execQueue:
			go e.executeJob(grafanaCtx, job)
		}
	}
}

func (e *Engine) executeJob(grafanaCtx context.Context, job *Job) error {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Execute Alert Panic", "error", err, "stack", log.Stack(1))
		}
	}()

	done := make(chan *EvalContext, 1)
	go func() {
		job.Running = true
		context := NewEvalContext(job.Rule)
		e.evalHandler.Eval(context)
		job.Running = false
		done <- context
		close(done)
	}()

	select {

	case <-grafanaCtx.Done():
		return grafanaCtx.Err()
	case evalContext := <-done:
		e.resultQueue <- evalContext
	}

	return nil
}

func (e *Engine) resultDispatcher(grafanaCtx context.Context) error {
	for {
		select {
		case <-grafanaCtx.Done():
			//handle all responses before shutting down.
			for result := range e.resultQueue {
				e.handleResponse(result)
			}

			return grafanaCtx.Err()
		case result := <-e.resultQueue:
			e.handleResponse(result)
		}
	}
}

func (e *Engine) handleResponse(result *EvalContext) {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Panic in resultDispatcher", "error", err, "stack", log.Stack(1))
		}
	}()

	e.log.Debug("Alert Rule Result", "ruleId", result.Rule.Id, "firing", result.Firing)
	e.resultHandler.Handle(result)
}
