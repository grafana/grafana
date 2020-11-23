package ngalert

import (
	"context"
	"sync"
	"time"
)

func (ng *AlertNG) definitionRoutine(definitionID int64, evalCh <-chan *evalContext) {
	ng.schedule.alertDefinitionsRunning.Add(1)
	defer ng.schedule.alertDefinitionsRunning.Done()

	ng.log.Debug("alert definition routine started", "definitionID", definitionID)

	evalRunning := false
	var lastEvalStarted, lastEvalEnded time.Time
	// TODO retry
	for {
		select {
		case ctx := <-evalCh:
			if !evalRunning {
				lastEvalStarted = timeNow()
				res, err := ng.alertDefinitionEval(definitionID, ctx.now)
				lastEvalEnded = timeNow()
				if err != nil {
					ng.log.Info("alert definition evaluation failed", "definitionID", definitionID, "duration", lastEvalEnded.Sub(lastEvalStarted), "error", err)
					continue
				}
				df, err := (*res).Decoded()
				if err != nil {
					ng.log.Info("alert definition decoding result failed", "definitionID", definitionID, "duration", lastEvalEnded.Sub(lastEvalStarted), "error", err)
				}
				s, err := df[0].StringTable(-1, -1)
				if err != nil {
					ng.log.Info("alert definition dataframe result conversion to string failed", "definitionID", definitionID, "duration", lastEvalEnded.Sub(lastEvalStarted), "error", err)
				}
				ng.log.Info("alert definition result", "definitionID", definitionID, "duration", lastEvalEnded.Sub(lastEvalStarted), "res", s)
				evalRunning = false
			}
		case id := <-ng.schedule.stop:
			if id == definitionID {
				// TODO what if it's running
				return
			}
		}
	}
}

func (ng *AlertNG) fetchAlertDefinitions(since time.Time) []*AlertDefinition {
	cmd := listAlertDefinitionsCommand{}
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

	cancelFunc context.CancelFunc

	ctx context.Context

	alertDefinitionsRunning sync.WaitGroup
}

func (sched *schedule) stopDefinitionRoutine(definitionID int64) {
	sched.stop <- definitionID
}

// Run starts the scheduler
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.log.Debug("ngalert starting")
	heartbeat := time.NewTicker(ng.schedule.baseInterval)
	var lastFetchTime time.Time
	for {
		select {
		case tick := <-heartbeat.C:
			alertDefinitions := ng.fetchAlertDefinitions(lastFetchTime)
			ng.log.Debug("alert definitions fetched", "count", len(alertDefinitions))

			// this is used for identify deleted alert definitions
			registeredDefinitions := ng.schedule.channelMap.keyMap()

			type readyToRunItem struct {
				id           int64
				definitionCh definitionCh
			}
			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertDefinitions {
				newRoutine := !ng.schedule.channelMap.exists(item.Id)
				definitionCh := ng.schedule.channelMap.getOrCreateChannel(item.Id)

				if newRoutine {
					go ng.definitionRoutine(item.Id, definitionCh.ch)
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

			// send loop is only required for distribute evaluations across time within an interval
			for _, item := range readyToRun {
				item.definitionCh.ch <- &evalContext{now: tick}
				time.Sleep(time.Duration(step))
			}

			// the remaining definitions are the deleted ones
			for id := range registeredDefinitions {
				ng.schedule.stopDefinitionRoutine(id)
				ng.schedule.channelMap.del(id)
			}

			lastFetchTime = tick
		case <-ng.schedule.ctx.Done():
			ng.log.Info("Stopping main schedule routine")
			ng.Close()
			return ng.schedule.ctx.Err()
		}
	}
}

// Close sends a signal for closing all routines and waits for them to get closed.
func (ng *AlertNG) Close() {
	ng.schedule.cancelFunc()
	ng.schedule.alertDefinitionsRunning.Wait()
}

type channelMap struct {
	mu         sync.Mutex
	definionCh map[int64]definitionCh
}

// getChannel returns the channel for the specific alert definition
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
