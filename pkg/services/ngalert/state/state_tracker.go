package state

import (
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type AlertState struct {
	UID         string
	OrgID       int64
	CacheId     string
	Labels      data.Labels
	State       eval.State
	Results     []eval.State
	StartsAt    time.Time
	EndsAt      time.Time
	EvaluatedAt time.Time
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

func (st *StateTracker) getOrCreate(uid string, orgId int64, result eval.Result) AlertState {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()

	idString := fmt.Sprintf("%s %s", uid, result.Instance.String())
	if state, ok := st.stateCache.cacheMap[idString]; ok {
		return state
	}
	st.Log.Debug("adding new alert state cache entry", "cacheId", idString, "state", result.State.String(), "evaluatedAt", result.EvaluatedAt.String())
	newState := AlertState{
		UID:         uid,
		OrgID:       orgId,
		CacheId:     idString,
		Labels:      result.Instance,
		State:       result.State,
		Results:     []eval.State{},
		EvaluatedAt: result.EvaluatedAt,
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
		if s, ok := st.setNextState(uid, condition.OrgID, result); ok {
			changedStates = append(changedStates, s)
		}
	}
	st.Log.Debug("returning changed states to scheduler", "count", len(changedStates))
	return changedStates
}

//Set the current state based on evaluation results
//return the state and a bool indicating whether a state transition occurred
func (st *StateTracker) setNextState(uid string, orgId int64, result eval.Result) (AlertState, bool) {
	currentState := st.getOrCreate(uid, orgId, result)
	st.Log.Debug("setting alert state", "uid", uid)
	switch {
	case currentState.State == result.State:
		st.Log.Debug("no state transition", "cacheId", currentState.CacheId, "state", currentState.State.String())
		currentState.EvaluatedAt = result.EvaluatedAt
		currentState.Results = append(currentState.Results, result.State)
		st.set(currentState)
		return currentState, false
	case currentState.State == eval.Normal && result.State == eval.Alerting:
		st.Log.Debug("state transition from normal to alerting", "cacheId", currentState.CacheId)
		currentState.State = eval.Alerting
		currentState.EvaluatedAt = result.EvaluatedAt
		currentState.StartsAt = result.EvaluatedAt
		currentState.EndsAt = result.EvaluatedAt.Add(40 * time.Second)
		currentState.Results = append(currentState.Results, result.State)
		st.set(currentState)
		return currentState, true
	case currentState.State == eval.Alerting && result.State == eval.Normal:
		st.Log.Debug("state transition from alerting to normal", "cacheId", currentState.CacheId)
		currentState.State = eval.Normal
		currentState.EvaluatedAt = result.EvaluatedAt
		currentState.EndsAt = result.EvaluatedAt
		currentState.Results = append(currentState.Results, result.State)
		st.set(currentState)
		return currentState, true
	default:
		return currentState, false
	}
}

func (st *StateTracker) GetAll() []AlertState {
	var states []AlertState
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	for _, v := range st.stateCache.cacheMap {
		states = append(states, v)
	}
	return states
}

func (st *StateTracker) cleanUp() {
	ticker := time.NewTicker(time.Duration(60) * time.Minute)
	st.Log.Debug("starting cleanup process", "intervalMinutes", 60)
	wg := sync.WaitGroup{}
	for {
		select {
		case <-ticker.C:
			wg.Add(1)
			go func() {
				defer wg.Done()
				st.trim()
			}()
			wg.Wait()
		case <-st.quit:
			st.Log.Debug("stopping cleanup process", "now", time.Now())
			ticker.Stop()
			return
		}
	}
}

func (st *StateTracker) trim() {
	st.Log.Info("trimming alert state cache", "now", time.Now())
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	for _, v := range st.stateCache.cacheMap {
		if len(v.Results) > 100 {
			st.Log.Debug("trimming result set", "cacheId", v.CacheId, "count", len(v.Results)-100)
			v.Results = v.Results[:len(v.Results)-100]
			st.set(v)
		}
	}
}

func (a AlertState) Equals(b AlertState) bool {
	return a.UID == b.UID &&
		a.OrgID == b.OrgID &&
		a.CacheId == b.CacheId &&
		a.Labels.String() == b.Labels.String() &&
		a.State.String() == b.State.String() &&
		resultsEquals(a.Results, b.Results) &&
		a.StartsAt == b.StartsAt &&
		a.EndsAt == b.EndsAt &&
		a.EvaluatedAt == b.EvaluatedAt
}

func resultsEquals(a, b []eval.State) bool {
	for i, s := range a {
		if s.String() != b[i].String() {
			return false
		}
	}
	return true
}
