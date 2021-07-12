package state

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type Manager struct {
	log     log.Logger
	metrics *metrics.Metrics

	cache       *cache
	quit        chan struct{}
	ResendDelay time.Duration

	ruleStore     store.RuleStore
	instanceStore store.InstanceStore
}

func NewManager(logger log.Logger, metrics *metrics.Metrics, ruleStore store.RuleStore, instanceStore store.InstanceStore) *Manager {
	manager := &Manager{
		cache:         newCache(logger, metrics),
		quit:          make(chan struct{}),
		ResendDelay:   1 * time.Minute, // TODO: make this configurable
		log:           logger,
		metrics:       metrics,
		ruleStore:     ruleStore,
		instanceStore: instanceStore,
	}
	go manager.recordMetrics()
	return manager
}

func (st *Manager) Close() {
	st.quit <- struct{}{}
}

func (st *Manager) Warm() {
	st.log.Info("warming cache for startup")
	st.ResetCache()

	orgIds, err := st.instanceStore.FetchOrgIds()
	if err != nil {
		st.log.Error("unable to fetch orgIds", "msg", err.Error())
	}

	var states []*State
	for _, orgId := range orgIds {
		// Get Rules
		ruleCmd := ngModels.ListAlertRulesQuery{
			OrgID: orgId,
		}
		if err := st.ruleStore.GetOrgAlertRules(&ruleCmd); err != nil {
			st.log.Error("unable to fetch previous state", "msg", err.Error())
		}

		ruleByUID := make(map[string]*ngModels.AlertRule, len(ruleCmd.Result))
		for _, rule := range ruleCmd.Result {
			ruleByUID[rule.UID] = rule
		}

		// Get Instances
		cmd := ngModels.ListAlertInstancesQuery{
			RuleOrgID: orgId,
		}
		if err := st.instanceStore.ListAlertInstances(&cmd); err != nil {
			st.log.Error("unable to fetch previous state", "msg", err.Error())
		}

		for _, entry := range cmd.Result {
			ruleForEntry, ok := ruleByUID[entry.RuleUID]
			if !ok {
				st.log.Error("rule not found for instance, ignoring", "rule", entry.RuleUID)
				continue
			}

			lbs := map[string]string(entry.Labels)
			cacheId, err := entry.Labels.StringKey()
			if err != nil {
				st.log.Error("error getting cacheId for entry", "msg", err.Error())
			}
			stateForEntry := &State{
				AlertRuleUID:       entry.RuleUID,
				OrgID:              entry.RuleOrgID,
				CacheId:            cacheId,
				Labels:             lbs,
				State:              translateInstanceState(entry.CurrentState),
				Results:            []Evaluation{},
				StartsAt:           entry.CurrentStateSince,
				EndsAt:             entry.CurrentStateEnd,
				LastEvaluationTime: entry.LastEvalTime,
				Annotations:        ruleForEntry.Annotations,
			}
			states = append(states, stateForEntry)
		}
	}

	for _, s := range states {
		st.set(s)
	}
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
	st.log.Debug("state manager processing evaluation results", "uid", alertRule.UID, "resultCount", len(results))
	var states []*State
	for _, result := range results {
		s := st.setNextState(alertRule, result)
		states = append(states, s)
	}
	st.log.Debug("returning changed states to scheduler", "count", len(states))
	return states
}

//Set the current state based on evaluation results
func (st *Manager) setNextState(alertRule *ngModels.AlertRule, result eval.Result) *State {
	currentState := st.getOrCreate(alertRule, result)

	currentState.LastEvaluationTime = result.EvaluatedAt
	currentState.EvaluationDuration = result.EvaluationDuration
	currentState.Results = append(currentState.Results, Evaluation{
		EvaluationTime:   result.EvaluatedAt,
		EvaluationState:  result.State,
		EvaluationString: result.EvaluationString,
		Values:           NewEvaluationValues(result.Values),
	})
	currentState.TrimResults(alertRule)
	oldState := currentState.State

	st.log.Debug("setting alert state", "uid", alertRule.UID)
	switch result.State {
	case eval.Normal:
		currentState.resultNormal(alertRule, result)
	case eval.Alerting:
		currentState.resultAlerting(alertRule, result)
	case eval.Error:
		currentState.resultError(alertRule, result)
	case eval.NoData:
		currentState.resultNoData(alertRule, result)
	case eval.Pending: // we do not emit results with this state
	}

	st.set(currentState)
	if oldState != currentState.State {
		go st.createAlertAnnotation(currentState.State, alertRule, result)
	}
	return currentState
}

func (st *Manager) GetAll(orgID int64) []*State {
	return st.cache.getAll(orgID)
}

func (st *Manager) GetStatesForRuleUID(orgID int64, alertRuleUID string) []*State {
	return st.cache.getStatesForRuleUID(orgID, alertRuleUID)
}

func (st *Manager) recordMetrics() {
	// TODO: parameterize?
	// Setting to a reasonable default scrape interval for Prometheus.
	dur := time.Duration(15) * time.Second
	ticker := time.NewTicker(dur)
	for {
		select {
		case <-ticker.C:
			st.log.Info("recording state cache metrics", "now", time.Now())
			st.cache.recordMetrics()
		case <-st.quit:
			st.log.Debug("stopping state cache metrics recording", "now", time.Now())
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

func translateInstanceState(state ngModels.InstanceStateType) eval.State {
	switch {
	case state == ngModels.InstanceStateFiring:
		return eval.Alerting
	case state == ngModels.InstanceStateNormal:
		return eval.Normal
	default:
		return eval.Error
	}
}

func (st *Manager) createAlertAnnotation(new eval.State, alertRule *ngModels.AlertRule, result eval.Result) {
	st.log.Debug("alert state changed creating annotation", "alertRuleUID", alertRule.UID, "newState", new.String())
	dashUid, ok := alertRule.Annotations["__dashboardUid__"]
	if !ok {
		return
	}

	panelUid := alertRule.Annotations["__panelId__"]

	panelId, err := strconv.ParseInt(panelUid, 10, 64)
	if err != nil {
		st.log.Error("error parsing panelUID for alert annotation", "panelUID", panelUid, "alertRuleUID", alertRule.UID, "error", err.Error())
		return
	}

	query := &models.GetDashboardQuery{
		Uid:   dashUid,
		OrgId: alertRule.OrgID,
	}

	err = sqlstore.GetDashboard(query)
	if err != nil {
		st.log.Error("error getting dashboard for alert annotation", "dashboardUID", dashUid, "alertRuleUID", alertRule.UID, "error", err.Error())
		return
	}

	annotationText := fmt.Sprintf("%s %s", result.Instance.String(), new.String())

	item := &annotations.Item{
		OrgId:       alertRule.OrgID,
		DashboardId: query.Result.Id,
		PanelId:     panelId,
		Text:        annotationText,
		Epoch:       result.EvaluatedAt.UnixNano() / int64(time.Millisecond),
	}

	annotationRepo := annotations.GetRepository()
	if err = annotationRepo.Save(item); err != nil {
		st.log.Error("error saving alert annotation", "alertRuleUID", alertRule.UID, "error", err.Error())
		return
	}
}
