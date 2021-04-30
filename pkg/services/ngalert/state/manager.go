package state

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Manager struct {
	cache *cache
	quit  chan struct{}
	Log   log.Logger
}

func NewManager(logger log.Logger) *Manager {
	manager := &Manager{
		cache: newCache(logger),
		quit:  make(chan struct{}),
		Log:   logger,
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

func (st *Manager) Get(id string) (*State, error) {
	return st.cache.get(id)
}

//Used to ensure a clean cache on startup
func (st *Manager) ResetCache() {
	st.cache.reset()
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

func (st *Manager) GetAll() []*State {
	return st.cache.getAll()
}

func (st *Manager) GetStatesByRuleUID() map[string][]*State {
	return st.cache.getStatesByRuleUID()
}

func (st *Manager) cleanUp() {
	ticker := time.NewTicker(time.Duration(60) * time.Minute)
	st.Log.Debug("starting cleanup process", "intervalMinutes", 60)
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
