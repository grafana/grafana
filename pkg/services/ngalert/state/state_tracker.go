package state

import (
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type AlertState struct {
	UID         string
	CacheId     string
	Labels      data.Labels
	State       eval.State
	Results     []eval.State
	StartsAt    strfmt.DateTime
	EndsAt      strfmt.DateTime
	EvaluatedAt strfmt.DateTime
}

type cache struct {
	cacheMap map[string]AlertState
	mu       sync.Mutex
}

type StateTracker struct {
	stateCache cache
	quit       chan struct{}
	Log        log.Logger
}

func NewStateTracker(logger log.Logger) *StateTracker {
	tracker := &StateTracker{
		stateCache: cache{
			cacheMap: make(map[string]AlertState),
			mu:       sync.Mutex{},
		},
		quit: make(chan struct{}),
		Log:  logger,
	}
	go tracker.cleanUp()
	return tracker
}

func (st *StateTracker) getOrCreate(uid string, result eval.Result) AlertState {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()

	idString := fmt.Sprintf("%s %s", uid, result.Instance.String())
	if state, ok := st.stateCache.cacheMap[idString]; ok {
		return state
	}
	st.Log.Debug("adding new alert state cache entry", "cacheId", idString, "state", result.State.String(), "evaluatedAt", result.EvaluatedAt.String())
	newState := AlertState{
		UID:         uid,
		CacheId:     idString,
		Labels:      result.Instance,
		State:       result.State,
		Results:     []eval.State{},
		EvaluatedAt: strfmt.DateTime(result.EvaluatedAt),
	}
	st.stateCache.cacheMap[idString] = newState
	return newState
}

func (st *StateTracker) set(stateEntry AlertState) {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	st.stateCache.cacheMap[stateEntry.CacheId] = stateEntry
}

func (st *StateTracker) get(stateId string) AlertState {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	return st.stateCache.cacheMap[stateId]
}

func (st *StateTracker) ProcessEvalResults(uid string, results eval.Results, condition ngModels.Condition) []AlertState {
	st.Log.Info("state tracker processing evaluation results", "uid", uid, "resultCount", len(results))
	var changedStates []AlertState
	for _, result := range results {
		if s, ok := st.setNextState(uid, result); ok {
			changedStates = append(changedStates, s)
		}
	}
	st.Log.Debug("returning changed states to scheduler", "count", len(changedStates))
	return changedStates
}

//TODO: When calculating if an alert should not be firing anymore, we should take three things into account:
// 1. The re-send the delay if any, we don't want to send every firing alert every time, we should have a fixed delay across all alerts to avoid saturating the notification system
// 2. The evaluation interval defined for this particular alert - we don't support that yet but will eventually allow you to define how often do you want this alert to be evaluted
// 3. The base interval defined by the scheduler - in the case where #2 is not yet an option we can use the base interval at which every alert runs.
//Set the current state based on evaluation results
//return the state and a bool indicating whether a state transition occurred
func (st *StateTracker) setNextState(uid string, result eval.Result) (AlertState, bool) {
	currentState := st.getOrCreate(uid, result)
	st.Log.Debug("setting alert state", "uid", uid)
	switch {
	case currentState.State == result.State:
		st.Log.Debug("no state transition", "cacheId", currentState.CacheId, "state", currentState.State.String())
		currentState.EvaluatedAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.Results = append(currentState.Results, result.State)
		if currentState.State == eval.Alerting {
			currentState.EndsAt = strfmt.DateTime(result.EvaluatedAt.Add(40 * time.Second))
		}
		st.set(currentState)
		return currentState, false
	case currentState.State == eval.Normal && result.State == eval.Alerting:
		st.Log.Debug("state transition from normal to alerting", "cacheId", currentState.CacheId)
		currentState.State = eval.Alerting
		currentState.EvaluatedAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.StartsAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.EndsAt = strfmt.DateTime(result.EvaluatedAt.Add(40 * time.Second))
		currentState.Results = append(currentState.Results, result.State)
		st.set(currentState)
		return currentState, true
	case currentState.State == eval.Alerting && result.State == eval.Normal:
		st.Log.Debug("state transition from alerting to normal", "cacheId", currentState.CacheId)
		currentState.State = eval.Normal
		currentState.EvaluatedAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.EndsAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.Results = append(currentState.Results, result.State)
		st.set(currentState)
		return currentState, true
	default:
		return currentState, false
	}
}

func (st *StateTracker) cleanUp() {
	ticker := time.NewTicker(time.Duration(60) * time.Minute)
	st.Log.Debug("starting cleanup process", "intervalMinutes", 60)
	for {
		select {
		case <-ticker.C:
			st.trim()
		case <-st.quit:
			st.Log.Debug("stopping cleanup process", "now", time.Now())
			ticker.Stop()
			return
		}
	}
}

func (st *StateTracker) trim() {
	st.Log.Info("trimming alert state cache")
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	for _, v := range st.stateCache.cacheMap {
		if len(v.Results) > 100 {
			st.Log.Debug("trimming result set", "cacheId", v.CacheId, "count", len(v.Results)-100)
			newResults := make([]eval.State, 100)
			copy(newResults, v.Results[100:])
			v.Results = newResults
			st.set(v)
		}
	}
}
