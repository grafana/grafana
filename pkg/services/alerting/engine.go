package alerting

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
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
	if !setting.ClusteringEnabled {
		alertGroup.Go(func() error { return e.alertingTicker(ctx) })
	}
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

	go func() {
		defer func() {
			if err := recover(); err != nil {
				e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
				close(done)
			}
		}()

		e.evalHandler.Eval(evalContext)
		e.resultHandler.Handle(evalContext)
		close(done)
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

func (e *Engine) GetPendingJobCount() int {
	return len(e.execQueue)
}

func (e *Engine) ScheduleAlertsForPartition(interval int64, partitionNo int, nodeCount int) error {
	if nodeCount == 0 {
		return errors.New("Node count is 0")
	}
	if partitionNo >= nodeCount {
		return errors.New(fmt.Sprintf("Invalid partitionNo %v (node count = %v)", partitionNo, nodeCount))
	}
	rules := e.ruleReader.Fetch()
	filterCount := 0
	intervalEnd := time.Unix(interval, 0).Add(time.Minute)
	for _, rule := range rules {
		// handle frequency greater than 1 min
		nextEvalDate := rule.EvalDate.Add(time.Duration(rule.Frequency) * time.Second)
		if nextEvalDate.Before(intervalEnd) {
			if rule.Id%int64(nodeCount) == int64(partitionNo) {
				e.execQueue <- &Job{Rule: rule}
				filterCount++
				e.log.Debug(fmt.Sprintf("Scheduled Rule : %v for interval=%v", rule, interval))
			} else {
				e.log.Debug(fmt.Sprintf("Skipped Rule : %v for interval=%v, partitionNo=%v, nodeCount=%v", rule, interval, partitionNo, nodeCount))
			}
		} else {
			e.log.Debug(fmt.Sprintf("Skipped Rule : %v for interval=%v, intervalEnd=%v, nextEvalDate=%v", rule, interval, intervalEnd, nextEvalDate))
		}
	}
	e.log.Info(fmt.Sprintf("%v/%v rules scheduled for execution for partition %v/%v",
		filterCount, len(rules), partitionNo, nodeCount))
	return nil
}
