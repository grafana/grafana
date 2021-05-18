package state

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Manager struct {
	cache   *cache
	quit    chan struct{}
	Log     log.Logger
	metrics *metrics.Metrics
}

func NewManager(logger log.Logger, metrics *metrics.Metrics) *Manager {
	manager := &Manager{
		cache:   newCache(logger, metrics),
		quit:    make(chan struct{}),
		Log:     logger,
		metrics: metrics,
	}
	go manager.cleanUp()
	return manager
}

func (st *Manager) Close() {
	st.quit <- struct{}{}
}

func (st *Manager) getOrCreate(alertRule *ngModels.AlertRule, result eval.Result) *State {
	return st.cache.getOrCreate(alertRule, result)
}

func (st *Manager) set(entry *State) {
	st.cache.set(entry)
}

func (st *Manager) Get(orgID int64, alertRuleUID, stateId string) (*State, error) {
	return st.cache.get(orgID, alertRuleUID, stateId)
}

// ResetCache is used to ensure a clean cache on startup.
func (st *Manager) ResetCache() {
	st.cache.reset()
}

// RemoveByRuleUID deletes all entries in the state manager that match the given rule UID.
func (st *Manager) RemoveByRuleUID(orgID int64, ruleUID string) {
	st.cache.removeByRuleUID(orgID, ruleUID)
}

func (st *Manager) ProcessEvalResults(alertRule *ngModels.AlertRule, results eval.Results) []*State {
	st.Log.Debug("state manager processing evaluation results", "uid", alertRule.UID, "resultCount", len(results))
	var states []*State
	for _, result := range results {
		s := st.setNextState(alertRule, result)
		states = append(states, s)
	}
	st.Log.Debug("returning changed states to scheduler", "count", len(states))
	return states
}

//TODO: When calculating if an alert should not be firing anymore, we should take into account the re-send delay if any. We don't want to send every firing alert every time, we should have a fixed delay across all alerts to avoid saturating the notification system
//Set the current state based on evaluation results
func (st *Manager) setNextState(alertRule *ngModels.AlertRule, result eval.Result) *State {
	currentState := st.getOrCreate(alertRule, result)

	currentState.LastEvaluationTime = result.EvaluatedAt
	currentState.EvaluationDuration = result.EvaluationDuration
	currentState.Results = append(currentState.Results, Evaluation{
		EvaluationTime:   result.EvaluatedAt,
		EvaluationState:  result.State,
		EvaluationString: result.EvaluationString,
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

func (st *Manager) GetAll(orgID int64) []*State {
	return st.cache.getAll(orgID)
}

func (st *Manager) GetStatesForRuleUID(orgID int64, alertRuleUID string) []*State {
	return st.cache.getStatesForRuleUID(orgID, alertRuleUID)
}

func (st *Manager) cleanUp() {
	// TODO: parameterize?
	// Setting to a reasonable default scrape interval for Prometheus.
	dur := time.Duration(15) * time.Second
	ticker := time.NewTicker(dur)
	st.Log.Debug("starting cleanup process", "dur", fmt.Sprint(dur))
	for {
		select {
		case <-ticker.C:
			st.Log.Info("trimming alert state cache", "now", time.Now())
			st.cache.trim()
		case <-st.quit:
			st.Log.Debug("stopping cleanup process", "now", time.Now())
			ticker.Stop()
			return
		}
	}
}

func (st *Manager) Put(states []*State) {
	for _, s := range states {
		st.set(s)
	}
}
