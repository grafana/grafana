package state

import (
	"fmt"
	"sync"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	promModels "github.com/prometheus/alertmanager/api/v2/models"
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
}

func NewStateTracker() *StateTracker {
	return &StateTracker{
		stateCache: cache{
			cacheMap: make(map[string]AlertState),
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
	}
	newState := AlertState{
		UID:         uid,
		CacheId:     idString,
		Labels:      result.Instance,
		State:       result.State,
		Results:     []eval.State{},
		EvaluatedAt: strfmt.DateTime(result.EvaluatedAt),
	}
	c.cacheMap[idString] = newState
	return newState
}

func (c *cache) set(stateEntry AlertState) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cacheMap[stateEntry.CacheId] = stateEntry
}

func (c *cache) get(stateId string) AlertState {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cacheMap[stateId]
}

func (st *StateTracker) ProcessEvalResults(uid string, results eval.Results, condition ngModels.Condition) []AlertState {
	var changedStates []AlertState
	for _, result := range results {
		if s, ok := st.setNextState(uid, result); ok {
			changedStates = append(changedStates, s)
		}
	}
	return changedStates
}

//Set the current state based on evaluation results
//return the state and a bool indicating whether a state transition occurred
func (st *StateTracker) setNextState(uid string, result eval.Result) (AlertState, bool) {
	currentState := st.stateCache.getOrCreate(uid, result)

	switch {
	case currentState.State == result.State:
		currentState.EvaluatedAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.Results = append(currentState.Results, result.State)
		st.stateCache.set(currentState)
		return currentState, false
	case currentState.State == eval.Normal && result.State == eval.Alerting:
		currentState.State = eval.Alerting
		currentState.EvaluatedAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.StartsAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.Results = append(currentState.Results, result.State)
		st.stateCache.set(currentState)
		return currentState, true
	case currentState.State == eval.Alerting && result.State == eval.Normal:
		currentState.State = eval.Normal
		currentState.EvaluatedAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.EndsAt = strfmt.DateTime(result.EvaluatedAt)
		currentState.Results = append(currentState.Results, result.State)
		st.stateCache.set(currentState)
		return currentState, true
	default:
		return currentState, false
	}
}

func FromAlertStateToPostableAlerts(firingStates []AlertState) []*notifier.PostableAlert {
	alerts := make([]*notifier.PostableAlert, 0, len(firingStates))
	for _, state := range firingStates {
		alerts = append(alerts, &notifier.PostableAlert{
			PostableAlert: promModels.PostableAlert{
				Annotations: promModels.LabelSet{},
				StartsAt:    state.StartsAt,
				EndsAt:      state.EndsAt,
				Alert: promModels.Alert{
					Labels: promModels.LabelSet(state.Labels),
				},
			},
		})
	}
	return alerts
}
