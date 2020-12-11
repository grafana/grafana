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
				if alertDefinition == nil || ctx.newVersion {
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
						ng.schedule.evalApplied(definitionID)
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
	evalApplied func(int64)

	log log.Logger
}

// newScheduler returns a new schedule.
func newScheduler(c clock.Clock, baseInterval time.Duration, logger log.Logger, evalApplied func(int64)) *schedule {
	ticker := alerting.NewTicker(c.Now(), time.Second*0, c, int64(baseInterval.Seconds()))
	sch := schedule{
		registry:     alertDefinitionRegistry{alertDefinitionEnvelop: make(map[int64]alertDefinitionEnvelop)},
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

func (sch *schedule) resetHeartbeatInterval(duration time.Duration) error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.ResetOffset(duration)
	sch.log.Info("alert definition scheduler interval reset", "now", sch.clock.Now(), "duration", duration)
	return nil
}

func (ng *AlertNG) alertingTicker(grafanaCtx context.Context) error {
	dispatcherGroup, ctx := errgroup.WithContext(grafanaCtx)
	c := ng.schedule.clock
	for {
		select {
		case tick := <-ng.schedule.heartbeat.C:
			alertDefinitions := ng.fetchAllDetails(tick)
			ng.schedule.log.Debug("alert definitions fetched", "count", len(alertDefinitions))

			// registeredDefinitions is a map used for finding deleted alert definitions
			// initially it is assigned to all known alert definitions from the previous cycle
			// each alert definition found also in this cycle is removed
			// so, at the end, the remaining registered alert definitions are the deleted ones
			registeredDefinitions := ng.schedule.registry.keyMap()

			type readyToRunItem struct {
				id                int64
				definitionEnvelop alertDefinitionEnvelop
				newVersion        bool
			}
			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertDefinitions {
				itemID := item.ID
				itemVersion := item.Version
				newRoutine := !ng.schedule.registry.exists(itemID)
				definitionEnvelop := ng.schedule.registry.getOrCreateEnvelop(itemID, itemVersion)
				newVersion := definitionEnvelop.version < itemVersion

				if newRoutine {
					dispatcherGroup.Go(func() error {
						return ng.definitionRoutine(ctx, itemID, definitionEnvelop.ch)
					})
				}

				if item.Interval != 0 && tick.Unix()%item.Interval == 0 {
					readyToRun = append(readyToRun, readyToRunItem{id: itemID, definitionEnvelop: definitionEnvelop, newVersion: newVersion})
				}

				// remove the alert definition from the registered alert definitions
				delete(registeredDefinitions, itemID)
			}

			var step int64 = 0
			if len(readyToRun) > 0 {
				step = ng.schedule.baseInterval.Nanoseconds() / int64(len(readyToRun))
			}

			fmt.Println(">>>> step:", step)
			for i := range readyToRun {
				item := readyToRun[i]

				c.AfterFunc(time.Duration(int64(i)*step), func() {
					item.definitionEnvelop.ch <- &evalContext{now: tick, newVersion: item.newVersion}
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
	mu                     sync.Mutex
	alertDefinitionEnvelop map[int64]alertDefinitionEnvelop
}

// getOrCreateEnvelop returns the channel for the specific alert definition
// if it does not exists creates one and returns it
func (r *alertDefinitionRegistry) getOrCreateEnvelop(definitionID int64, definitionVersion int64) alertDefinitionEnvelop {
	r.mu.Lock()
	defer r.mu.Unlock()

	ch, ok := r.alertDefinitionEnvelop[definitionID]
	if !ok {
		r.alertDefinitionEnvelop[definitionID] = alertDefinitionEnvelop{ch: make(chan *evalContext), version: definitionVersion}
		return r.alertDefinitionEnvelop[definitionID]
	}
	return ch
}

func (r *alertDefinitionRegistry) exists(definitionID int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.alertDefinitionEnvelop[definitionID]
	return ok
}

func (r *alertDefinitionRegistry) del(definitionID int64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.alertDefinitionEnvelop, definitionID)
}

func (r *alertDefinitionRegistry) iter() <-chan int64 {
	c := make(chan int64)

	f := func() {
		r.mu.Lock()
		defer r.mu.Unlock()

		for k := range r.alertDefinitionEnvelop {
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

type alertDefinitionEnvelop struct {
	ch      chan *evalContext
	version int64
}

type evalContext struct {
	now        time.Time
	newVersion bool
}
