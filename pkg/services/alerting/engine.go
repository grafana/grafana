package alerting

import (
	"context"
	"time"

	"github.com/opentracing/opentracing-go"
	tlog "github.com/opentracing/opentracing-go/log"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
	"golang.org/x/sync/errgroup"
)

type Engine struct {
	execQueue     chan *Job
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

	alertGroup, ctx := errgroup.WithContext(ctx)

	alertGroup.Go(func() error { return e.alertingTicker(ctx) })
	alertGroup.Go(func() error { return e.runJobDispatcher(ctx) })

	err := alertGroup.Wait()

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
	dispatcherGroup, alertCtx := errgroup.WithContext(grafanaCtx)

	for {
		select {
		case <-grafanaCtx.Done():
			return dispatcherGroup.Wait()
		case job := <-e.execQueue:
			dispatcherGroup.Go(func() error { return e.processJob(alertCtx, job) })
		}
	}
}

var (
	unfinishedWorkTimeout time.Duration = time.Second * 5
	alertTimeout          time.Duration = time.Second * 30
)

func (e *Engine) processJob(grafanaCtx context.Context, job *Job) error {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
		}
	}()

	alertCtx, cancelFn := context.WithTimeout(context.Background(), alertTimeout)

	job.Running = true
	evalContext := NewEvalContext(alertCtx, job.Rule)

	done := make(chan struct{})

	span := opentracing.StartSpan("alerting")
	alertCtx = opentracing.ContextWithSpan(alertCtx, span)
	evalContext.Ctx = alertCtx

	go func() {
		defer func() {
			if err := recover(); err != nil {
				e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
				close(done)
			}
		}()

		e.evalHandler.Eval(evalContext)
		e.resultHandler.Handle(evalContext)
		span.LogFields(
			tlog.Int64("alertId", evalContext.Rule.Id),
			tlog.Int64("dashboardId", evalContext.Rule.DashboardId),
			tlog.Bool("firing", evalContext.Firing),
		)

		close(done)
		span.Finish()
	}()

	var err error = nil
	select {
	case <-grafanaCtx.Done():
		select {
		case <-time.After(unfinishedWorkTimeout):
			cancelFn()
			err = grafanaCtx.Err()
		case <-done:
		}
	case <-done:
	}

	e.log.Debug("Job Execution completed", "timeMs", evalContext.GetDurationMs(), "alertId", evalContext.Rule.Id, "name", evalContext.Rule.Name, "firing", evalContext.Firing)
	job.Running = false
	cancelFn()
	return err
}
