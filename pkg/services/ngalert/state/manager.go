package state

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var ResendDelay = 30 * time.Second

// LOGZ.IO GRAFANA CHANGE :: Evict old entries from state manager
const EvaluationDelayToClearAlertState = time.Duration(1) * time.Hour
const ClearOldAlertFrequency = time.Duration(40) * time.Minute

// LOGZ.IO GRAFANA CHANGE :: end

// LOGZ.IO GRAFANA CHANGE :: Manage annotations and instances only on one peer of HA cluster
const ShouldManageAnnotationsAndInstancesContextKey = "logzio_should_manage_ualert_annotations_instances"

// AlertInstanceManager defines the interface for querying the current alert instances.
type AlertInstanceManager interface {
	GetAll(orgID int64) []*State
	GetStatesForRuleUID(orgID int64, alertRuleUID string) []*State
}

type Manager struct {
	log     log.Logger
	metrics *metrics.State

	cache       *cache
	quit        chan struct{}
	ResendDelay time.Duration

	ruleStore     store.RuleStore
	instanceStore store.InstanceStore
	sqlStore      sqlstore.Store
}

func NewManager(logger log.Logger, metrics *metrics.State, externalURL *url.URL, ruleStore store.RuleStore,
	instanceStore store.InstanceStore, sqlStore sqlstore.Store) *Manager {
	manager := &Manager{
		cache:         newCache(logger, metrics, externalURL),
		quit:          make(chan struct{}),
		ResendDelay:   ResendDelay, // TODO: make this configurable
		log:           logger,
		metrics:       metrics,
		ruleStore:     ruleStore,
		instanceStore: instanceStore,
		sqlStore:      sqlStore,
	}
	go manager.recordMetrics()
	go manager.clearOldEntries()
	return manager
}

func (st *Manager) Close() {
	st.quit <- struct{}{}
}

func (st *Manager) Warm(ctx context.Context) {
	st.log.Info("warming cache for startup")
	st.ResetCache()

	orgIds, err := st.instanceStore.FetchOrgIds(ctx)
	if err != nil {
		st.log.Error("unable to fetch orgIds", "msg", err.Error())
	}

	var states []*State
	for _, orgId := range orgIds {
		// Get Rules
		ruleCmd := ngModels.ListAlertRulesQuery{
			OrgID: orgId,
		}
		if err := st.ruleStore.ListAlertRules(ctx, &ruleCmd); err != nil {
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
		if err := st.instanceStore.ListAlertInstances(ctx, &cmd); err != nil {
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
				AlertRuleUID:         entry.RuleUID,
				OrgID:                entry.RuleOrgID,
				CacheId:              cacheId,
				Labels:               lbs,
				State:                translateInstanceState(entry.CurrentState),
				LastEvaluationString: "",
				StartsAt:             entry.CurrentStateSince,
				EndsAt:               entry.CurrentStateEnd,
				LastEvaluationTime:   entry.LastEvalTime,
				Annotations:          ruleForEntry.Annotations,
			}
			states = append(states, stateForEntry)
		}
	}

	for _, s := range states {
		st.set(s)
	}
}

func (st *Manager) getOrCreate(ctx context.Context, alertRule *ngModels.AlertRule, result eval.Result) *State {
	return st.cache.getOrCreate(ctx, alertRule, result)
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

func (st *Manager) ProcessEvalResults(ctx context.Context, alertRule *ngModels.AlertRule, results eval.Results) []*State {
	st.log.Debug("state manager processing evaluation results", "uid", alertRule.UID, "resultCount", len(results))
	var states []*State
	processedResults := make(map[string]*State, len(results))
	for _, result := range results {
		s := st.setNextState(ctx, alertRule, result)
		states = append(states, s)
		processedResults[s.CacheId] = s
	}
	st.staleResultsHandler(ctx, alertRule, processedResults)
	return states
}

// Set the current state based on evaluation results
func (st *Manager) setNextState(ctx context.Context, alertRule *ngModels.AlertRule, result eval.Result) *State {
	currentState := st.getOrCreate(ctx, alertRule, result)

	currentState.LastEvaluationTime = result.EvaluatedAt
	currentState.EvaluationDuration = result.EvaluationDuration
	currentState.Results = append(currentState.Results, Evaluation{
		EvaluationTime:  result.EvaluatedAt,
		EvaluationState: result.State,
		Values:          NewEvaluationValues(result.Values),
		Condition:       alertRule.Condition,
	})
	currentState.LastEvaluationString = result.EvaluationString
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

	// Set Resolved property so the scheduler knows to send a postable alert
	// to Alertmanager.
	currentState.Resolved = oldState == eval.Alerting && currentState.State == eval.Normal

	st.set(currentState)
	if oldState != currentState.State {
		// LOGZ.IO GRAFANA CHANGE :: Manage annotations and instances only on one peer of HA cluster
		shouldManageAnnotations := ctx.Value(ShouldManageAnnotationsAndInstancesContextKey).(bool)
		if shouldManageAnnotations {
			go st.annotateState(ctx, alertRule, currentState.Labels, result.EvaluatedAt, currentState.State, oldState)
		}
		// LOGZ.IO GRAFANA CHANGE :: end
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
			st.log.Debug("recording state cache metrics", "now", time.Now())
			st.cache.recordMetrics()
		case <-st.quit:
			st.log.Debug("stopping state cache metrics recording", "now", time.Now())
			ticker.Stop()
			return
		}
	}
}

// LOGZ.IO GRAFANA CHANGE :: Clear old entries from state cache
func (st *Manager) clearOldEntries() {
	ticker := time.NewTicker(ClearOldAlertFrequency)

	for {
		select {
		case <-ticker.C:
			st.log.Debug("clearing old alert states", "now", time.Now())
			for orgId := range st.cache.states {
				st.clearDeletedAlertEntriesForOrg(orgId)
			}
		case <-st.quit:
			st.log.Debug("stopping old alert clear routine", "now", time.Now())
			ticker.Stop()
			return
		}
	}
}

func (st *Manager) clearDeletedAlertEntriesForOrg(orgId int64) {
	lastStatePerRuleUuid := make(map[string]*State)
	shouldRemove := func(state *State, now time.Time) bool {
		if state != nil {
			return state.LastEvaluationTime.Add(EvaluationDelayToClearAlertState).Before(now) &&
				state.EndsAt.Before(now)
		} else {
			return false
		}
	}

	for _, state := range st.GetAll(orgId) {
		if lastState, found := lastStatePerRuleUuid[state.AlertRuleUID]; found {
			if state.LastEvaluationTime.After(lastState.LastEvaluationTime) {
				lastStatePerRuleUuid[state.AlertRuleUID] = state
			}
		} else {
			lastStatePerRuleUuid[state.AlertRuleUID] = state
		}
	}

	now := time.Now()
	totalCleared := 0
	for ruleUID, lastState := range lastStatePerRuleUuid {
		if shouldRemove(lastState, now) {
			st.RemoveByRuleUID(orgId, ruleUID)
			totalCleared++
		}
	}

	if totalCleared == 0 {
		st.log.Debug("No alerts cleared from state cache")
	} else {
		st.log.Debug("Cleared alerts from state cache", "total cleared", totalCleared)
	}
}

// LOGZ.IO GRAFANA CHANGE :: end

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

func (st *Manager) annotateState(ctx context.Context, alertRule *ngModels.AlertRule, labels data.Labels, evaluatedAt time.Time, state eval.State, previousState eval.State) {
	st.log.Debug("alert state changed creating annotation", "alertRuleUID", alertRule.UID, "newState", state.String(), "oldState", previousState.String())

	labels = removePrivateLabels(labels)
	annotationText := fmt.Sprintf("%s {%s} - %s", alertRule.Title, labels.String(), state.String())

	item := &annotations.Item{
		AlertId:   alertRule.ID,
		OrgId:     alertRule.OrgID,
		PrevState: previousState.String(),
		NewState:  state.String(),
		Text:      annotationText,
		Type:      ngModels.AlertRuleStateAnnotationType, // LOGZ.IO GRAFANA CHANGE :: DEV-31760 - Save annotations with a specific type for unified alerts
		Epoch:     evaluatedAt.UnixNano() / int64(time.Millisecond),
	}

	dashUid, ok := alertRule.Annotations[ngModels.DashboardUIDAnnotation]
	if ok {
		panelUid := alertRule.Annotations[ngModels.PanelIDAnnotation]

		panelId, err := strconv.ParseInt(panelUid, 10, 64)
		if err != nil {
			st.log.Error("error parsing panelUID for alert annotation", "panelUID", panelUid, "alertRuleUID", alertRule.UID, "error", err.Error())
			return
		}

		query := &models.GetDashboardQuery{
			Uid:   dashUid,
			OrgId: alertRule.OrgID,
		}

		err = st.sqlStore.GetDashboard(ctx, query)
		if err != nil {
			st.log.Error("error getting dashboard for alert annotation", "dashboardUID", dashUid, "alertRuleUID", alertRule.UID, "error", err.Error())
			return
		}

		item.PanelId = panelId
		item.DashboardId = query.Result.Id
	}

	annotationRepo := annotations.GetRepository()
	if err := annotationRepo.Save(item); err != nil {
		st.log.Error("error saving alert annotation", "alertRuleUID", alertRule.UID, "error", err.Error())
		return
	}
}

func (st *Manager) staleResultsHandler(ctx context.Context, alertRule *ngModels.AlertRule, states map[string]*State) {
	allStates := st.GetStatesForRuleUID(alertRule.OrgID, alertRule.UID)
	toDelete := make([]ngModels.AlertInstanceKey, 0)

	for _, s := range allStates {
		_, ok := states[s.CacheId]
		if !ok && isItStale(s.LastEvaluationTime, alertRule.IntervalSeconds) {
			st.log.Debug("removing stale state entry", "orgID", s.OrgID, "alertRuleUID", s.AlertRuleUID, "cacheID", s.CacheId)
			st.cache.deleteEntry(s.OrgID, s.AlertRuleUID, s.CacheId)
			ilbs := ngModels.InstanceLabels(s.Labels)
			_, labelsHash, err := ilbs.StringAndHash()
			if err != nil {
				st.log.Error("unable to get labelsHash", "error", err.Error(), "orgID", s.OrgID, "alertRuleUID", s.AlertRuleUID)
			}

			toDelete = append(toDelete, ngModels.AlertInstanceKey{RuleOrgID: s.OrgID, RuleUID: s.AlertRuleUID, LabelsHash: labelsHash})

			if s.State == eval.Alerting {
				st.annotateState(ctx, alertRule, s.Labels, time.Now(), eval.Normal, s.State)
			}
		}
	}

	if err := st.instanceStore.DeleteAlertInstances(ctx, toDelete...); err != nil {
		st.log.Error("unable to delete stale instances from database", "err", err.Error(),
			"orgID", alertRule.OrgID, "alertRuleUID", alertRule.UID, "count", len(toDelete))
	}
}

func isItStale(lastEval time.Time, intervalSeconds int64) bool {
	return lastEval.Add(2 * time.Duration(intervalSeconds) * time.Second).Before(time.Now())
}

func removePrivateLabels(labels data.Labels) data.Labels {
	result := make(data.Labels)
	for k, v := range labels {
		if !strings.HasPrefix(k, "__") && !strings.HasSuffix(k, "__") {
			result[k] = v
		}
	}
	return result
}
