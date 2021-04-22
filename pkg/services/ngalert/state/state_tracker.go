package state

import (
	"fmt"
	"sync"
	"time"

	prometheusModel "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type AlertState struct {
	AlertRuleUID       string
	OrgID              int64
	CacheId            string
	Labels             data.Labels
	State              eval.State
	Results            []StateEvaluation
	StartsAt           time.Time
	EndsAt             time.Time
	LastEvaluationTime time.Time
	EvaluationDuration time.Duration
	Annotations        map[string]string
}

type StateEvaluation struct {
	EvaluationTime  time.Time
	EvaluationState eval.State
}

type cache struct {
	states    map[string]AlertState
	mtxStates sync.Mutex
}

type StateTracker struct {
	cache cache
	quit  chan struct{}
	Log   log.Logger
}

func NewStateTracker(logger log.Logger) *StateTracker {
	tracker := &StateTracker{
		cache: cache{
			states: make(map[string]AlertState),
		},
		quit: make(chan struct{}),
		Log:  logger,
	}
	go tracker.cleanUp()
	return tracker
}

func (st *StateTracker) getOrCreate(alertRule *ngModels.AlertRule, result eval.Result, evaluationDuration time.Duration) AlertState {
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()

	// if duplicate labels exist, alertRule label will take precedence
	lbs := mergeLabels(alertRule.Labels, result.Instance)
	lbs["__alert_rule_uid__"] = alertRule.UID
	lbs["__alert_rule_namespace_uid__"] = alertRule.NamespaceUID
	lbs[prometheusModel.AlertNameLabel] = alertRule.Title

	id := fmt.Sprintf("%s", map[string]string(lbs))
	if state, ok := st.cache.states[id]; ok {
		return state
	}

	annotations := map[string]string{}
	if len(alertRule.Annotations) > 0 {
		annotations = alertRule.Annotations
	}

	newResults := []StateEvaluation{
		{
			EvaluationTime:  result.EvaluatedAt,
			EvaluationState: result.State,
		},
	}

	st.Log.Debug("adding new alert state cache entry", "cacheId", id, "state", result.State.String(), "evaluatedAt", result.EvaluatedAt.String())
	newState := AlertState{
		AlertRuleUID:       alertRule.UID,
		OrgID:              alertRule.OrgID,
		CacheId:            id,
		Labels:             lbs,
		State:              result.State,
		Results:            newResults,
		Annotations:        annotations,
		EvaluationDuration: evaluationDuration,
	}
	if result.State == eval.Alerting {
		newState.StartsAt = result.EvaluatedAt
	}
	st.cache.states[id] = newState
	return newState
}

func (st *StateTracker) set(entry AlertState) {
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	st.cache.states[entry.CacheId] = entry
}

func (st *StateTracker) Get(id string) AlertState {
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	return st.cache.states[id]
}

//Used to ensure a clean cache on startup
func (st *StateTracker) ResetCache() {
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	st.cache.states = make(map[string]AlertState)
}

func (st *StateTracker) ProcessEvalResults(alertRule *ngModels.AlertRule, results eval.Results, evaluationDuration time.Duration) []AlertState {
	st.Log.Info("state tracker processing evaluation results", "uid", alertRule.UID, "resultCount", len(results))
	var states []AlertState
	for _, result := range results {
		s := st.setNextState(alertRule, result, evaluationDuration)
		states = append(states, s)
	}
	st.Log.Debug("returning changed states to scheduler", "count", len(states))
	return states
}

//TODO: When calculating if an alert should not be firing anymore, we should take three things into account:
// 1. The re-send the delay if any, we don't want to send every firing alert every time, we should have a fixed delay across all alerts to avoid saturating the notification system
//Set the current state based on evaluation results
func (st *StateTracker) setNextState(alertRule *ngModels.AlertRule, result eval.Result, evaluationDuration time.Duration) AlertState {
	currentState := st.getOrCreate(alertRule, result, evaluationDuration)
	st.Log.Debug("setting alert state", "uid", alertRule.UID)
	switch {
	case currentState.State == result.State:
		st.Log.Debug("no state transition", "cacheId", currentState.CacheId, "state", currentState.State.String())
		currentState.LastEvaluationTime = result.EvaluatedAt
		currentState.EvaluationDuration = evaluationDuration
		currentState.Results = append(currentState.Results, StateEvaluation{
			EvaluationTime:  result.EvaluatedAt,
			EvaluationState: result.State,
		})
		if currentState.State == eval.Alerting {
			//TODO: Move me and unify me with the top level constant
			// 10 seconds is the base evaluation interval. We use 2 times that interval to make sure we send an alert
			// that would expire after at least 2 iterations and avoid flapping.
			resendDelay := 10 * 2 * time.Second
			if alertRule.For > resendDelay {
				resendDelay = alertRule.For * 2
			}
			currentState.EndsAt = result.EvaluatedAt.Add(resendDelay)
		}
		st.set(currentState)
		return currentState
	case currentState.State == eval.Normal && result.State == eval.Alerting:
		st.Log.Debug("state transition from normal to alerting", "cacheId", currentState.CacheId)
		currentState.State = eval.Alerting
		currentState.LastEvaluationTime = result.EvaluatedAt
		currentState.StartsAt = result.EvaluatedAt
		currentState.EndsAt = result.EvaluatedAt.Add(alertRule.For * time.Second)
		currentState.EvaluationDuration = evaluationDuration
		currentState.Results = append(currentState.Results, StateEvaluation{
			EvaluationTime:  result.EvaluatedAt,
			EvaluationState: result.State,
		})
		currentState.Annotations["alerting"] = result.EvaluatedAt.String()
		st.set(currentState)
		return currentState
	case currentState.State == eval.Alerting && result.State == eval.Normal:
		st.Log.Debug("state transition from alerting to normal", "cacheId", currentState.CacheId)
		currentState.State = eval.Normal
		currentState.LastEvaluationTime = result.EvaluatedAt
		currentState.EndsAt = result.EvaluatedAt
		currentState.EvaluationDuration = evaluationDuration
		currentState.Results = append(currentState.Results, StateEvaluation{
			EvaluationTime:  result.EvaluatedAt,
			EvaluationState: result.State,
		})
		st.set(currentState)
		return currentState
	default:
		return currentState
	}
}

func (st *StateTracker) GetAll() []AlertState {
	var states []AlertState
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	for _, v := range st.cache.states {
		states = append(states, v)
	}
	return states
}

func (st *StateTracker) GetStatesByRuleUID() map[string][]AlertState {
	ruleMap := make(map[string][]AlertState)
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	for _, state := range st.cache.states {
		if ruleStates, ok := ruleMap[state.AlertRuleUID]; ok {
			ruleStates = append(ruleStates, state)
			ruleMap[state.AlertRuleUID] = ruleStates
		} else {
			ruleStates := []AlertState{state}
			ruleMap[state.AlertRuleUID] = ruleStates
		}
	}
	return ruleMap
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
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	for _, v := range st.cache.states {
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
	return a.AlertRuleUID == b.AlertRuleUID &&
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

// if duplicate labels exist, keep the value from the first set
func mergeLabels(a, b data.Labels) data.Labels {
	newLbs := data.Labels{}
	for k, v := range a {
		newLbs[k] = v
	}
	for k, v := range b {
		if _, ok := newLbs[k]; !ok {
			newLbs[k] = v
		}
	}
	return newLbs
}
