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
	UID                string
	OrgID              int64
	CacheId            string
	Labels             data.Labels
	State              eval.State
	Results            []StateEvaluation
	StartsAt           time.Time
	EndsAt             time.Time
	LastEvaluationTime time.Time
	Annotations        map[string]string
}

type StateEvaluation struct {
	EvaluationTime  time.Time
	EvaluationState eval.State
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

func (st *StateTracker) getOrCreate(alertRule *ngModels.AlertRule, result eval.Result) AlertState {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	lbs := data.Labels{}
	if len(result.Instance) > 0 {
		lbs = result.Instance
	}
	lbs["__alert_rule_uid__"] = alertRule.UID
	lbs["__alert_rule_namespace_uid__"] = alertRule.NamespaceUID
	lbs["__alert_rule_title__"] = alertRule.Title

	annotations := map[string]string{}
	if len(alertRule.Annotations) > 0 {
		annotations = alertRule.Annotations
	}

	idString := fmt.Sprintf("%s", map[string]string(lbs))
	if state, ok := st.stateCache.cacheMap[idString]; ok {
		return state
	}

	st.Log.Debug("adding new alert state cache entry", "cacheId", idString, "state", result.State.String(), "evaluatedAt", result.EvaluatedAt.String())
	newState := AlertState{
		UID:         alertRule.UID,
		OrgID:       alertRule.OrgID,
		CacheId:     idString,
		Labels:      lbs,
		State:       result.State,
		Results:     []StateEvaluation{},
		Annotations: annotations,
	}
	if result.State == eval.Alerting {
		newState.StartsAt = result.EvaluatedAt
	}
	st.stateCache.cacheMap[idString] = newState
	return newState
}

func (st *StateTracker) set(stateEntry AlertState) {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	st.stateCache.cacheMap[stateEntry.CacheId] = stateEntry
}

func (st *StateTracker) Get(stateId string) AlertState {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	return st.stateCache.cacheMap[stateId]
}

//Used to ensure a clean cache on startup
func (st *StateTracker) ResetCache() {
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	st.stateCache.cacheMap = make(map[string]AlertState)
}

func (st *StateTracker) ProcessEvalResults(alertRule *ngModels.AlertRule, results eval.Results) []AlertState {
	st.Log.Info("state tracker processing evaluation results", "uid", alertRule.UID, "resultCount", len(results))
	var changedStates []AlertState
	for _, result := range results {
		s, _ := st.setNextState(alertRule, result)
		changedStates = append(changedStates, s)
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
func (st *StateTracker) setNextState(alertRule *ngModels.AlertRule, result eval.Result) (AlertState, bool) {
	currentState := st.getOrCreate(alertRule, result)
	st.Log.Debug("setting alert state", "uid", alertRule.UID)
	switch {
	case currentState.State == result.State:
		st.Log.Debug("no state transition", "cacheId", currentState.CacheId, "state", currentState.State.String())
		currentState.LastEvaluationTime = result.EvaluatedAt
		currentState.Results = append(currentState.Results, StateEvaluation{
			EvaluationTime:  result.EvaluatedAt,
			EvaluationState: result.State,
		})
		if currentState.State == eval.Alerting {
			currentState.EndsAt = result.EvaluatedAt.Add(40 * time.Second)
		}
		st.set(currentState)
		return currentState, false
	case currentState.State == eval.Normal && result.State == eval.Alerting:
		st.Log.Debug("state transition from normal to alerting", "cacheId", currentState.CacheId)
		currentState.State = eval.Alerting
		currentState.LastEvaluationTime = result.EvaluatedAt
		currentState.StartsAt = result.EvaluatedAt
		currentState.EndsAt = result.EvaluatedAt.Add(40 * time.Second)
		currentState.Results = append(currentState.Results, StateEvaluation{
			EvaluationTime:  result.EvaluatedAt,
			EvaluationState: result.State,
		})
		currentState.Annotations["alerting"] = result.EvaluatedAt.String()
		st.set(currentState)
		return currentState, true
	case currentState.State == eval.Alerting && result.State == eval.Normal:
		st.Log.Debug("state transition from alerting to normal", "cacheId", currentState.CacheId)
		currentState.State = eval.Normal
		currentState.LastEvaluationTime = result.EvaluatedAt
		currentState.EndsAt = result.EvaluatedAt
		currentState.Results = append(currentState.Results, StateEvaluation{
			EvaluationTime:  result.EvaluatedAt,
			EvaluationState: result.State,
		})
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
	st.Log.Info("trimming alert state cache", "now", time.Now())
	st.stateCache.mu.Lock()
	defer st.stateCache.mu.Unlock()
	for _, v := range st.stateCache.cacheMap {
		if len(v.Results) > 100 {
			st.Log.Debug("trimming result set", "cacheId", v.CacheId, "count", len(v.Results)-100)
			newResults := make([]StateEvaluation, 100)
			copy(newResults, v.Results[100:])
			v.Results = newResults
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
		a.StartsAt == b.StartsAt &&
		a.EndsAt == b.EndsAt &&
		a.LastEvaluationTime == b.LastEvaluationTime
}

func (st *StateTracker) Put(states []AlertState) {
	for _, s := range states {
		st.set(s)
	}
}
