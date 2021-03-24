package state

import (
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"sync"
)

type AlertState struct {
	UID     string
	CacheId string
	Labels  data.Labels
	State   eval.State
	Results []eval.State
}

type cache struct {
	cacheMap map[string]AlertState
	mu       sync.Mutex
}

type StateTracker struct {
	stateCache cache
}

func NewStateTracker() *StateTracker {
	return &StateTracker{
		stateCache: cache{
			cacheMap: make(map[string]AlertState, 0),
			mu:       sync.Mutex{},
		},
	}
}

func (c *cache) getOrCreate(uid string, result eval.Result) AlertState {
	c.mu.Lock()
	defer c.mu.Unlock()

	idString := fmt.Sprintf("%s %s", uid, result.Instance.String())
	if state, ok := c.cacheMap[idString]; ok {
		return state
	} else {
		state := AlertState{
			UID:     uid,
			CacheId: idString,
			Labels:  result.Instance,
			State:   result.State,
			Results: []eval.State{result.State},
		}
		c.cacheMap[idString] = state
		return state
	}
}

func (c *cache) update(stateEntry AlertState) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cacheMap[stateEntry.CacheId] = stateEntry
}

func (c *cache) getStateForEntry(stateId string) eval.State {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cacheMap[stateId].State
}

func (st *StateTracker) ProcessEvalResults(uid string, results eval.Results, condition models.Condition) {
	for _, result := range results {
		currentState := st.stateCache.getOrCreate(uid, result)
		currentState.Results = append(currentState.Results, result.State)
		currentState.State = st.getNextState(uid, result)
		st.stateCache.update(currentState)
	}
}

func (st *StateTracker) getNextState(uid string, result eval.Result) eval.State {
	currentState := st.stateCache.getOrCreate(uid, result)
	if currentState.State == result.State {
		return currentState.State
	}

	switch {
	case currentState.State == result.State:
		return currentState.State
	case currentState.State == eval.Normal && result.State == eval.Alerting:
		return eval.Alerting
	case currentState.State == eval.Alerting && result.State == eval.Normal:
		return eval.Normal
	default:
		return eval.Alerting
	}
}
