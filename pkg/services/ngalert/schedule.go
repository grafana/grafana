package ngalert

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"golang.org/x/sync/errgroup"
)

func (ng *AlertNG) definitionRoutine(grafanaCtx context.Context, definitionID int64, evalCh <-chan *evalContext) error {
	ng.log.Debug("alert definition routine started", "definitionID", definitionID)

	evalRunning := false
	var start, end time.Time
	var attempt int64
	for {
		select {
		case ctx := <-evalCh:
			if evalRunning {
				continue
			}

			evaluate := func(attempt int64) error {
				start = timeNow()
				results, err := ng.alertDefinitionEval(definitionID, ctx.now)
				end = timeNow()
				if err != nil {
					ng.log.Error("failed to evaluate alert definition", "definitionID", definitionID, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "error", err)
					return err
				}
				for _, r := range results {
					ng.log.Info("alert definition result", "definitionID", definitionID, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "instance", r.Instance, "state", r.State.String())
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
				ng.log.Debug("stopping alert definition routine", "definitionID", definitionID)
				// interrupt evaluation if it's running
				return nil
			}
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
		}
	}
}

func (ng *AlertNG) fetchAlertDefinitions(now time.Time) []*AlertDefinition {
	cmd := listAlertDefinitionsQuery{}
	err := ng.getAlertDefinitions(&cmd) // tmp
	if err != nil {
		ng.log.Error("failed to fetch updated alert definitions", "now", now, "err", err)
		return nil
	}
	return cmd.Result
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert definition gets its own channel and routine
	channelMap channelMap

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
		channelMap:   channelMap{definionCh: make(map[int64]definitionCh)},
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
			start := c.Now()
			alertDefinitions := ng.fetchAlertDefinitions(tick)
			ng.log.Debug("alert definitions fetched", "count", len(alertDefinitions))

			// registeredDefinitions is a map used for finding deleted alert definitions
			// initially it is assigned to all known alert definitions from the previous cycle
			// each alert definition found also in this cycle is removed
			// so, at the end, the remaining registered alert definitions are the deleted ones
			registeredDefinitions := ng.schedule.channelMap.keyMap()

			type readyToRunItem struct {
				id           int64
				definitionCh definitionCh
			}
			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertDefinitions {
				itemID := item.ID
				newRoutine := !ng.schedule.channelMap.exists(itemID)
				definitionCh := ng.schedule.channelMap.getOrCreateChannel(itemID)

				if newRoutine {
					dispatcherGroup.Go(func() error {
						return ng.definitionRoutine(ctx, itemID, definitionCh.ch)
					})
				}

				if item.Interval != 0 && tick.Unix()%item.Interval == 0 {
					readyToRun = append(readyToRun, readyToRunItem{id: itemID, definitionCh: definitionCh})
				}

				// remove the alert definition from the registered alert definitions
				delete(registeredDefinitions, itemID)
			}
			lostTime := c.Now().Sub(start)

			var step int64 = 0
			if len(readyToRun) > 0 {
				step = (time.Second.Nanoseconds() - lostTime.Nanoseconds()) / int64(len(readyToRun))
			}

			for i := range readyToRun {
				item := readyToRun[i]
				c.AfterFunc(time.Duration(int64(i)*step), func() {
					item.definitionCh.ch <- &evalContext{now: tick}
				})
			}

			// unregister and stop routines of the deleted alert definitions
			for id := range registeredDefinitions {
				ng.schedule.stop <- id
				ng.schedule.channelMap.del(id)
			}
		case <-grafanaCtx.Done():
			err := dispatcherGroup.Wait()
			return err
		}
	}
}

type channelMap struct {
	mu         sync.Mutex
	definionCh map[int64]definitionCh
}

// getOrCreateChannel returns the channel for the specific alert definition
// if it does not exists creates one and returns it
func (chm *channelMap) getOrCreateChannel(definitionID int64) definitionCh {
	chm.mu.Lock()
	defer chm.mu.Unlock()

	ch, ok := chm.definionCh[definitionID]
	if !ok {
		chm.definionCh[definitionID] = definitionCh{ch: make(chan *evalContext)}
		return chm.definionCh[definitionID]
	}
	return ch
}

func (chm *channelMap) exists(definitionID int64) bool {
	chm.mu.Lock()
	defer chm.mu.Unlock()

	_, ok := chm.definionCh[definitionID]
	return ok
}

func (chm *channelMap) del(definitionID int64) {
	chm.mu.Lock()
	defer chm.mu.Unlock()

	delete(chm.definionCh, definitionID)
}

func (chm *channelMap) iter() <-chan int64 {
	c := make(chan int64)

	f := func() {
		chm.mu.Lock()
		defer chm.mu.Unlock()

		for k := range chm.definionCh {
			c <- k
		}
		close(c)
	}
	go f()

	return c
}

func (chm *channelMap) keyMap() map[int64]struct{} {
	definitionsIDs := make(map[int64]struct{})
	for definitionID := range chm.iter() {
		definitionsIDs[definitionID] = struct{}{}
	}
	return definitionsIDs
}

type definitionCh struct {
	ch chan *evalContext
}

type evalContext struct {
	now time.Time
}
