package ngalert

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
)

func (ng *AlertNG) definitionRoutine(grafanaCtx context.Context, definitionID int64, evalCh <-chan *evalContext) error {
	ng.log.Debug("alert definition routine started", "definitionID", definitionID)

	evalRunning := false
	var lastEvalStarted, lastEvalEnded time.Time
	var attempt int64
	for {
		select {
		case ctx := <-evalCh:
			if evalRunning {
				continue
			}

			evaluate := func(attempt int64) error {
				lastEvalStarted = timeNow()
				results, err := ng.alertDefinitionEval(definitionID, ctx.now)
				lastEvalEnded = timeNow()
				if err != nil {
					ng.log.Info("failed to evaluate alert definition", "definitionID", definitionID, "attempt", attempt, "duration", lastEvalEnded.Sub(lastEvalStarted), "error", err)
					return err
				}
				for _, r := range results {
					ng.log.Info("alert definition result", "definitionID", definitionID, "duration", lastEvalEnded.Sub(lastEvalStarted), "instance", r.Instance, "state", r.State.String())
				}
				return nil
			}

			func() {
				evalRunning = true
				defer func() {
					evalRunning = false
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
				// TODO what if it's running
				return nil
			}
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
		}
	}
}

func (ng *AlertNG) fetchAlertDefinitions(since time.Time) []*AlertDefinition {
	cmd := listAlertDefinitionsQuery{}
	err := ng.getAlertDefinitions(&cmd) // tmp
	if err != nil {
		ng.log.Error("failed to fetch updated alert definitions", "since", since, "err", err)
		return nil
	}
	return cmd.Result
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert definition gets its own channel and
	// routine. Will need lock as well. A map so when can
	// update a specific routine if it is
	channelMap channelMap

	// broadcast channel for stopping definition routines
	stop chan int64

	maxAttempts int64
}

func (ng *AlertNG) alertingTicker(grafanaCtx context.Context) error {
	dispatcherGroup, ctx := errgroup.WithContext(grafanaCtx)
	heartbeat := time.NewTicker(ng.schedule.baseInterval)
	var lastFetchTime time.Time
	for {
		select {
		case tick := <-heartbeat.C:
			alertDefinitions := ng.fetchAlertDefinitions(lastFetchTime)
			ng.log.Debug("alert definitions fetched", "count", len(alertDefinitions))

			// this is used for identifying deleted alert definitions
			registeredDefinitions := ng.schedule.channelMap.keyMap()

			type readyToRunItem struct {
				id           int64
				definitionCh definitionCh
			}
			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertDefinitions {
				itemID := item.Id
				newRoutine := !ng.schedule.channelMap.exists(itemID)
				definitionCh := ng.schedule.channelMap.getOrCreateChannel(itemID)

				if newRoutine {
					dispatcherGroup.Go(func() error {
						return ng.definitionRoutine(ctx, itemID, definitionCh.ch)
					})
				}

				if tick.Unix()%item.Interval == 0 {
					readyToRun = append(readyToRun, readyToRunItem{id: item.Id, definitionCh: definitionCh})
				}

				delete(registeredDefinitions, item.Id)
			}

			if len(readyToRun) == 0 {
				continue
			}

			step := int(ng.schedule.baseInterval.Nanoseconds()) / len(readyToRun)

			// second loop is only required for distribute evaluations across time within an interval
			for _, item := range readyToRun {
				item.definitionCh.ch <- &evalContext{now: tick}
				time.Sleep(time.Duration(step))
			}

			// the remaining definitions are the deleted ones
			for id := range registeredDefinitions {
				ng.schedule.stop <- id
				ng.schedule.channelMap.del(id)
			}
			lastFetchTime = tick
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
