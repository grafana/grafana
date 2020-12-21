package ngalert

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"golang.org/x/sync/errgroup"
)

func (ng *AlertNG) definitionRoutine(grafanaCtx context.Context, definitionID int64, evalCh <-chan *evalContext) error {
	ng.log.Debug("alert definition routine started", "definitionID", definitionID)

	evalRunning := false
	var start, end time.Time
	var attempt int64
	var alertDefinition *AlertDefinition
	for {
		select {
		case ctx := <-evalCh:
			if evalRunning {
				continue
			}

			evaluate := func(attempt int64) error {
				start = timeNow()

				// fetch latest alert definition version
				if alertDefinition == nil || alertDefinition.Version < ctx.version {
					q := getAlertDefinitionByIDQuery{ID: definitionID}
					err := ng.getAlertDefinitionByID(&q)
					if err != nil {
						ng.schedule.log.Error("failed to fetch alert definition", "alertDefinitionID", alertDefinition.ID)
						return err
					}
					alertDefinition = q.Result
					ng.schedule.log.Debug("new alert definition version fetched", "alertDefinitionID", alertDefinition.ID, "version", alertDefinition.Version)
				}

				condition := eval.Condition{
					RefID:                 alertDefinition.Condition,
					OrgID:                 alertDefinition.OrgID,
					QueriesAndExpressions: alertDefinition.Data,
				}
				results, err := eval.ConditionEval(&condition, ctx.now)
				end = timeNow()
				if err != nil {
					ng.schedule.log.Error("failed to evaluate alert definition", "definitionID", definitionID, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "error", err)
					return err
				}
				for _, r := range results {
					ng.schedule.log.Info("alert definition result", "definitionID", definitionID, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "instance", r.Instance, "state", r.State.String())
				}
				return nil
			}

			func() {
				evalRunning = true
				defer func() {
					evalRunning = false
					if ng.schedule.evalApplied != nil {
						ng.schedule.evalApplied(definitionID, ctx.now)
					}
				}()

				for attempt = 0; attempt < ng.schedule.maxAttempts; attempt++ {
					err := evaluate(attempt)
					if err == nil {
						break
					}
				}
			}()
		case id := <-ng.schedule.stop:
			if id == definitionID {
				ng.schedule.log.Debug("stopping alert definition routine", "definitionID", definitionID)
				// interrupt evaluation if it's running
				return nil
			}
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
		}
	}
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert definition gets its own channel and routine
	registry alertDefinitionRegistry

	// broadcast channel for stopping definition routines
	stop chan int64

	maxAttempts int64

	clock clock.Clock

	heartbeat *alerting.Ticker

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalApplied func(int64, time.Time)

	log log.Logger
}

// newScheduler returns a new schedule.
func newScheduler(c clock.Clock, baseInterval time.Duration, logger log.Logger, evalApplied func(int64, time.Time)) *schedule {
	ticker := alerting.NewTicker(c.Now(), time.Second*0, c, int64(baseInterval.Seconds()))
	sch := schedule{
		registry:     alertDefinitionRegistry{alertDefinitionInfo: make(map[int64]alertDefinitionInfo)},
		stop:         make(chan int64),
		maxAttempts:  maxAttempts,
		clock:        c,
		baseInterval: baseInterval,
		log:          logger,
		heartbeat:    ticker,
		evalApplied:  evalApplied,
	}
	return &sch
}

func (sch *schedule) pause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Pause()
	sch.log.Info("alert definition scheduler paused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) unpause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Unpause()
	sch.log.Info("alert definition scheduler unpaused", "now", sch.clock.Now())
	return nil
}

func (ng *AlertNG) alertingTicker(grafanaCtx context.Context) error {
	dispatcherGroup, ctx := errgroup.WithContext(grafanaCtx)
	for {
		select {
		case tick := <-ng.schedule.heartbeat.C:
			tickNum := tick.Unix() / int64(ng.schedule.baseInterval.Seconds())
			alertDefinitions := ng.fetchAllDetails(tick)
			ng.schedule.log.Debug("alert definitions fetched", "count", len(alertDefinitions))

			// registeredDefinitions is a map used for finding deleted alert definitions
			// initially it is assigned to all known alert definitions from the previous cycle
			// each alert definition found also in this cycle is removed
			// so, at the end, the remaining registered alert definitions are the deleted ones
			registeredDefinitions := ng.schedule.registry.keyMap()

			type readyToRunItem struct {
				id             int64
				definitionInfo alertDefinitionInfo
			}
			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertDefinitions {
				itemID := item.ID
				itemVersion := item.Version
				newRoutine := !ng.schedule.registry.exists(itemID)
				definitionInfo := ng.schedule.registry.getOrCreateInfo(itemID, itemVersion)
				invalidInterval := item.IntervalSeconds%int64(ng.schedule.baseInterval.Seconds()) != 0

				if newRoutine && !invalidInterval {
					dispatcherGroup.Go(func() error {
						return ng.definitionRoutine(ctx, itemID, definitionInfo.ch)
					})
				}

				if invalidInterval {
					// this is expected to be always false
					// give that we validate interval during alert definition updates
					ng.schedule.log.Debug("alert definition with invalid interval will be ignored: interval should be divided exactly by scheduler interval", "definitionID", itemID, "interval", time.Duration(item.IntervalSeconds)*time.Second, "scheduler interval", ng.schedule.baseInterval)
					continue
				}

				itemFrequency := item.IntervalSeconds / int64(ng.schedule.baseInterval.Seconds())
				if item.IntervalSeconds != 0 && tickNum%itemFrequency == 0 {
					readyToRun = append(readyToRun, readyToRunItem{id: itemID, definitionInfo: definitionInfo})
				}

				// remove the alert definition from the registered alert definitions
				delete(registeredDefinitions, itemID)
			}

			var step int64 = 0
			if len(readyToRun) > 0 {
				step = ng.schedule.baseInterval.Nanoseconds() / int64(len(readyToRun))
			}

			for i := range readyToRun {
				item := readyToRun[i]

				time.AfterFunc(time.Duration(int64(i)*step), func() {
					item.definitionInfo.ch <- &evalContext{now: tick, version: item.definitionInfo.version}
				})
			}

			// unregister and stop routines of the deleted alert definitions
			for id := range registeredDefinitions {
				ng.schedule.stop <- id
				ng.schedule.registry.del(id)
			}
		case <-grafanaCtx.Done():
			err := dispatcherGroup.Wait()
			return err
		}
	}
}

type alertDefinitionRegistry struct {
	mu                  sync.Mutex
	alertDefinitionInfo map[int64]alertDefinitionInfo
}

// getOrCreateInfo returns the channel for the specific alert definition
// if it does not exists creates one and returns it
func (r *alertDefinitionRegistry) getOrCreateInfo(definitionID int64, definitionVersion int64) alertDefinitionInfo {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertDefinitionInfo[definitionID]
	if !ok {
		r.alertDefinitionInfo[definitionID] = alertDefinitionInfo{ch: make(chan *evalContext), version: definitionVersion}
		return r.alertDefinitionInfo[definitionID]
	}
	info.version = definitionVersion
	r.alertDefinitionInfo[definitionID] = info
	return info
}

func (r *alertDefinitionRegistry) exists(definitionID int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.alertDefinitionInfo[definitionID]
	return ok
}

func (r *alertDefinitionRegistry) del(definitionID int64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.alertDefinitionInfo, definitionID)
}

func (r *alertDefinitionRegistry) iter() <-chan int64 {
	c := make(chan int64)

	f := func() {
		r.mu.Lock()
		defer r.mu.Unlock()

		for k := range r.alertDefinitionInfo {
			c <- k
		}
		close(c)
	}
	go f()

	return c
}

func (r *alertDefinitionRegistry) keyMap() map[int64]struct{} {
	definitionsIDs := make(map[int64]struct{})
	for definitionID := range r.iter() {
		definitionsIDs[definitionID] = struct{}{}
	}
	return definitionsIDs
}

type alertDefinitionInfo struct {
	ch      chan *evalContext
	version int64
}

type evalContext struct {
	now     time.Time
	version int64
}
