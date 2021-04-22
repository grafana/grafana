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

type State struct {
	AlertRuleUID       string
	OrgID              int64
	CacheId            string
	Labels             data.Labels
	State              eval.State
	Results            []Evaluation
	StartsAt           time.Time
	EndsAt             time.Time
	LastEvaluationTime time.Time
	EvaluationDuration time.Duration
	Annotations        map[string]string
}

type Evaluation struct {
	EvaluationTime  time.Time
	EvaluationState eval.State
}

type cache struct {
	states    map[string]State
	mtxStates sync.Mutex
}

type Manager struct {
	cache cache
	quit  chan struct{}
	Log   log.Logger
}

func NewManager(logger log.Logger) *Manager {
	manager := &Manager{
		cache: cache{
			states: make(map[string]State),
		},
		quit: make(chan struct{}),
		Log:  logger,
	}
	go manager.cleanUp()
	return manager
}

func (st *Manager) Close() {
	st.quit <- struct{}{}
}

func (st *Manager) getOrCreate(alertRule *ngModels.AlertRule, result eval.Result) State {
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

	// If the first result we get is alerting, set StartsAt to EvaluatedAt because we
	// do not have data for determining StartsAt otherwise
	st.Log.Debug("adding new alert state cache entry", "cacheId", id, "state", result.State.String(), "evaluatedAt", result.EvaluatedAt.String())
	newState := State{
		AlertRuleUID:       alertRule.UID,
		OrgID:              alertRule.OrgID,
		CacheId:            id,
		Labels:             lbs,
		State:              result.State,
		Annotations:        annotations,
		EvaluationDuration: result.EvaluationDuration,
	}
	if result.State == eval.Alerting {
		newState.StartsAt = result.EvaluatedAt
	}
	st.cache.states[id] = newState
	return newState
}

func (st *Manager) set(entry State) {
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	st.cache.states[entry.CacheId] = entry
}

func (st *Manager) Get(id string) State {
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	return st.cache.states[id]
}

//Used to ensure a clean cache on startup
func (st *Manager) ResetCache() {
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	st.cache.states = make(map[string]State)
}

func (st *Manager) ProcessEvalResults(alertRule *ngModels.AlertRule, results eval.Results) []State {
	st.Log.Info("state tracker processing evaluation results", "uid", alertRule.UID, "resultCount", len(results))
	var states []State
	for _, result := range results {
		s := st.setNextState(alertRule, result)
		states = append(states, s)
	}
	st.Log.Debug("returning changed states to scheduler", "count", len(states))
	return states
}

//TODO: When calculating if an alert should not be firing anymore, we should take three things into account:
// 1. The re-send the delay if any, we don't want to send every firing alert every time, we should have a fixed delay across all alerts to avoid saturating the notification system
//Set the current state based on evaluation results
func (st *Manager) setNextState(alertRule *ngModels.AlertRule, result eval.Result) State {
	currentState := st.getOrCreate(alertRule, result)

	currentState.LastEvaluationTime = result.EvaluatedAt
	currentState.EvaluationDuration = result.EvaluationDuration
	currentState.Results = append(currentState.Results, Evaluation{
		EvaluationTime:  result.EvaluatedAt,
		EvaluationState: result.State,
	})

	st.Log.Debug("setting alert state", "uid", alertRule.UID)
	switch result.State {
	case eval.Normal:
		currentState = resultNormal(currentState, result)
	case eval.Alerting:
		currentState = currentState.resultAlerting(alertRule, result)
	case eval.Error:
		currentState = currentState.resultError(alertRule, result)
	case eval.NoData:
		currentState = currentState.resultNoData(alertRule, result)
	case eval.Pending: // we do not emit results with this state
	}

	st.set(currentState)
	return currentState
}

func resultNormal(alertState State, result eval.Result) State {
	newState := alertState
	if alertState.State != eval.Normal {
		newState.EndsAt = result.EvaluatedAt
	}
	newState.State = eval.Normal
	return newState
}

func (a State) resultAlerting(alertRule *ngModels.AlertRule, result eval.Result) State {
	switch a.State {
	case eval.Alerting:
		if !(alertRule.For > 0) {
			// If there is not For set, we will set EndsAt to be twice the evaluation interval
			// to avoid flapping with every evaluation
			a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
			return a
		}
		a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
	case eval.Pending:
		if result.EvaluatedAt.Sub(a.StartsAt) > alertRule.For {
			a.State = eval.Alerting
			a.StartsAt = result.EvaluatedAt
			a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
			a.Annotations["alerting_at"] = result.EvaluatedAt.String()
		}
	default:
		a.StartsAt = result.EvaluatedAt
		if !(alertRule.For > 0) {
			a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
			a.State = eval.Alerting
			a.Annotations["alerting_at"] = result.EvaluatedAt.String()
		} else {
			a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
			if result.EvaluatedAt.Sub(a.StartsAt) > alertRule.For {
				a.State = eval.Alerting
				a.Annotations["alerting_at"] = result.EvaluatedAt.String()
			} else {
				a.State = eval.Pending
			}
		}
	}
	return a
}

func (a State) resultError(alertRule *ngModels.AlertRule, result eval.Result) State {
	if a.StartsAt.IsZero() {
		a.StartsAt = result.EvaluatedAt
	}
	if !(alertRule.For > 0) {
		a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
	} else {
		a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
	}
	if a.State != eval.Error {
		a.Annotations["last_error"] = result.EvaluatedAt.String()
	}

	switch alertRule.ExecErrState {
	case ngModels.AlertingErrState:
		a.State = eval.Alerting
	case ngModels.KeepLastStateErrState:
	}
	return a
}

func (a State) resultNoData(alertRule *ngModels.AlertRule, result eval.Result) State {
	if a.StartsAt.IsZero() {
		a.StartsAt = result.EvaluatedAt
	}
	if !(alertRule.For > 0) {
		a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
	} else {
		a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
	}
	if a.State != eval.NoData {
		a.Annotations["no_data"] = result.EvaluatedAt.String()
	}

	switch alertRule.NoDataState {
	case ngModels.Alerting:
		a.State = eval.Alerting
	case ngModels.NoData:
		a.State = eval.NoData
	case ngModels.KeepLastState:
	case ngModels.OK:
		a.State = eval.Normal
	}
	return a
}

func (st *Manager) GetAll() []State {
	var states []State
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	for _, v := range st.cache.states {
		states = append(states, v)
	}
	return states
}

func (st *Manager) GetStatesByRuleUID() map[string][]State {
	ruleMap := make(map[string][]State)
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	for _, state := range st.cache.states {
		if ruleStates, ok := ruleMap[state.AlertRuleUID]; ok {
			ruleStates = append(ruleStates, state)
			ruleMap[state.AlertRuleUID] = ruleStates
		} else {
			ruleStates := []State{state}
			ruleMap[state.AlertRuleUID] = ruleStates
		}
	}
	return ruleMap
}

func (st *Manager) cleanUp() {
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

func (st *Manager) trim() {
	st.Log.Info("trimming alert state cache", "now", time.Now())
	st.cache.mtxStates.Lock()
	defer st.cache.mtxStates.Unlock()
	for _, v := range st.cache.states {
		if len(v.Results) > 100 {
			st.Log.Debug("trimming result set", "cacheId", v.CacheId, "count", len(v.Results)-100)
			newResults := make([]Evaluation, 100)
			copy(newResults, v.Results[100:])
			v.Results = newResults
			st.set(v)
		}
	}
}

func (a State) Equals(b State) bool {
	return a.AlertRuleUID == b.AlertRuleUID &&
		a.OrgID == b.OrgID &&
		a.CacheId == b.CacheId &&
		a.Labels.String() == b.Labels.String() &&
		a.State.String() == b.State.String() &&
		a.StartsAt == b.StartsAt &&
		a.EndsAt == b.EndsAt &&
		a.LastEvaluationTime == b.LastEvaluationTime
}

func (st *Manager) Put(states []State) {
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
