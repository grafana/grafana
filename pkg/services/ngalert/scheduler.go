package ngalert

import (
	"sync"
	"time"
)

func (ng *AlertNG) definitionRoutine(definitionID int64, evalCh <-chan *evalContext) {
	//evalRunning := false
	//timeout
	for {
		select {
		case <-evalCh:
			// check if it's running already
			// eval
			ng.alertDefinitionEval(definitionID, "now-3h", "now")
		case ids := <-ng.schedule.stop:
			for _, id := range ids {
				if id == definitionID {
					return
				}
			}
		}
	}
}

func (ng *AlertNG) fetchUpdatedAlertDefinitions(since time.Time) []*int64 {
	cmd := listUpdatedAlertDefinitionsCommand{Since: since}
	err := ng.getUpdatedAlertDefinitions(cmd) // tmp
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

	//broadcast channel for stopping definition routines
	stop chan []int64
}

func (sched *schedule) stopDefinitionRoutines(definitionIDs []int64) {
	sched.stop <- definitionIDs
}

// Run starts the scheduler.
func (ng *AlertNG) Run(sch *schedule) {
	heartbeat := time.Tick(sch.baseInterval)
	var lastFetchTime time.Time
	for {
		select {
		case tick := <-heartbeat:
			//fetch updated definitions
			updatedDefinitionIDs := ng.fetchUpdatedAlertDefinitions(lastFetchTime)
			//start routines for updated definitions
			for _, ID := range updatedDefinitionIDs {
				if !ng.schedule.channelMap.exists(*ID) {
					definionCh := ng.schedule.channelMap.getOrCreateChannel(*ID)
					go ng.definitionRoutine(*ID, definionCh.ch)
				}
			}
			//terminate routines for deleted definitions
			lastFetchTime = tick
		}
	}

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

type definitionCh struct {
	ch chan *evalContext
}

type evalContext struct {
	now time.Time
}
