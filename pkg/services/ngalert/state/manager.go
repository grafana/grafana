package state

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	ResendDelay           = 30 * time.Second
	MetricsScrapeInterval = 15 * time.Second // TODO: parameterize? // Setting to a reasonable default scrape interval for Prometheus.
)

// AlertInstanceManager defines the interface for querying the current alert instances.
type AlertInstanceManager interface {
	GetAll(orgID int64) []*State
	GetStatesForRuleUID(orgID int64, alertRuleUID string) []*State
}

type Manager struct {
	log     log.Logger
	metrics *metrics.State

	clock       clock.Clock
	cache       *cache
	ResendDelay time.Duration

	instanceStore InstanceStore
	images        ImageCapturer
	historian     Historian
	externalURL   *url.URL
}

func NewManager(metrics *metrics.State, externalURL *url.URL, instanceStore InstanceStore, images ImageCapturer, clock clock.Clock, historian Historian) *Manager {
	return &Manager{
		cache:         newCache(),
		ResendDelay:   ResendDelay, // TODO: make this configurable
		log:           log.New("ngalert.state.manager"),
		metrics:       metrics,
		instanceStore: instanceStore,
		images:        images,
		historian:     historian,
		clock:         clock,
		externalURL:   externalURL,
	}
}

func (st *Manager) Run(ctx context.Context) error {
	ticker := st.clock.Ticker(MetricsScrapeInterval)
	for {
		select {
		case <-ticker.C:
			st.log.Debug("Recording state cache metrics", "now", st.clock.Now())
			st.cache.recordMetrics(st.metrics)
		case <-ctx.Done():
			st.log.Debug("Stopping")
			ticker.Stop()
			return ctx.Err()
		}
	}
}

func (st *Manager) Warm(ctx context.Context, rulesReader RuleReader) {
	if st.instanceStore == nil {
		st.log.Info("Skip warming the state because instance store is not configured")
		return
	}
	startTime := time.Now()
	st.log.Info("Warming state cache for startup")

	orgIds, err := st.instanceStore.FetchOrgIds(ctx)
	if err != nil {
		st.log.Error("Unable to fetch orgIds", "error", err)
	}

	statesCount := 0
	states := make(map[int64]map[string]*ruleStates, len(orgIds))
	for _, orgId := range orgIds {
		// Get Rules
		ruleCmd := ngModels.ListAlertRulesQuery{
			OrgID: orgId,
		}
		if err := rulesReader.ListAlertRules(ctx, &ruleCmd); err != nil {
			st.log.Error("Unable to fetch previous state", "error", err)
		}

		ruleByUID := make(map[string]*ngModels.AlertRule, len(ruleCmd.Result))
		for _, rule := range ruleCmd.Result {
			ruleByUID[rule.UID] = rule
		}

		orgStates := make(map[string]*ruleStates, len(ruleByUID))
		states[orgId] = orgStates

		// Get Instances
		cmd := ngModels.ListAlertInstancesQuery{
			RuleOrgID: orgId,
		}
		if err := st.instanceStore.ListAlertInstances(ctx, &cmd); err != nil {
			st.log.Error("Unable to fetch previous state", "error", err)
		}

		for _, entry := range cmd.Result {
			ruleForEntry, ok := ruleByUID[entry.RuleUID]
			if !ok {
				// TODO Should we delete the orphaned state from the db?
				continue
			}

			rulesStates, ok := orgStates[entry.RuleUID]
			if !ok {
				rulesStates = &ruleStates{states: make(map[string]*State)}
				orgStates[entry.RuleUID] = rulesStates
			}

			lbs := map[string]string(entry.Labels)
			cacheID, err := entry.Labels.StringKey()
			if err != nil {
				st.log.Error("Error getting cacheId for entry", "error", err)
			}
			rulesStates.states[cacheID] = &State{
				AlertRuleUID:         entry.RuleUID,
				OrgID:                entry.RuleOrgID,
				CacheID:              cacheID,
				Labels:               lbs,
				State:                translateInstanceState(entry.CurrentState),
				StateReason:          entry.CurrentReason,
				LastEvaluationString: "",
				StartsAt:             entry.CurrentStateSince,
				EndsAt:               entry.CurrentStateEnd,
				LastEvaluationTime:   entry.LastEvalTime,
				Annotations:          ruleForEntry.Annotations,
			}
			statesCount++
		}
	}
	st.cache.setAllStates(states)
	st.log.Info("State cache has been initialized", "states", statesCount, "duration", time.Since(startTime))
}

func (st *Manager) Get(orgID int64, alertRuleUID, stateId string) *State {
	return st.cache.get(orgID, alertRuleUID, stateId)
}

// ResetStateByRuleUID deletes all entries in the state manager that match the given rule UID.
func (st *Manager) ResetStateByRuleUID(ctx context.Context, ruleKey ngModels.AlertRuleKey) []*State {
	logger := st.log.New(ruleKey.LogContext()...)
	logger.Debug("Resetting state of the rule")
	states := st.cache.removeByRuleUID(ruleKey.OrgID, ruleKey.UID)
	if len(states) > 0 && st.instanceStore != nil {
		err := st.instanceStore.DeleteAlertInstancesByRule(ctx, ruleKey)
		if err != nil {
			logger.Error("Failed to delete states that belong to a rule from database", "error", err)
		}
	}
	logger.Info("Rules state was reset", "states", len(states))
	return states
}

// ProcessEvalResults updates the current states that belong to a rule with the evaluation results.
// if extraLabels is not empty, those labels will be added to every state. The extraLabels take precedence over rule labels and result labels
func (st *Manager) ProcessEvalResults(ctx context.Context, evaluatedAt time.Time, alertRule *ngModels.AlertRule, results eval.EvaluationResult, extraLabels data.Labels) []StateTransition {
	logger := st.log.FromContext(ctx)
	states := st.updateRuleStates(ctx, logger, results, alertRule, extraLabels)
	staleStates := st.deleteStaleStatesFromCache(ctx, logger, evaluatedAt, alertRule)
	st.deleteAlertStates(ctx, logger, staleStates)

	st.saveAlertStates(ctx, logger, states...)

	allChanges := append(states, staleStates...)
	if st.historian != nil {
		st.historian.RecordStatesAsync(ctx, alertRule, allChanges)
	}
	return allChanges
}

func (st *Manager) updateRuleStates(ctx context.Context, logger log.Logger, results eval.EvaluationResult, alertRule *ngModels.AlertRule, extraLabels data.Labels) []StateTransition {
	if results.Error != nil {
		logger.Debug("Processing evaluation error", "mapping", alertRule.ExecErrState)
		switch alertRule.ExecErrState {
		case ngModels.OkErrState:
			return st.setAllStates(ctx, logger, alertRule, results, eval.Normal, "Error:"+results.Error.Error())
		case ngModels.AlertingErrState:
			return st.setAllStates(ctx, logger, alertRule, results, eval.Alerting, "Error:"+results.Error.Error())
		case ngModels.ErrorErrState:
			r := eval.Result{
				Instance:           nil,
				State:              eval.Error,
				Error:              results.Error,
				EvaluatedAt:        results.EvaluatedAt,
				EvaluationDuration: results.EvaluationDuration,
			}
			s := st.cache.getOrCreate(ctx, st.log, alertRule, r, extraLabels, st.externalURL)
			transition := setNextState(ctx, logger, st.images, alertRule, r, s, "")
			st.cache.set(transition.State)
			return []StateTransition{transition}
		}
	}
	if results.NoData != nil {
		logger.Debug("Processing evaluation no data", "mapping", alertRule.NoDataState)
		switch alertRule.NoDataState {
		case ngModels.OK:
			return st.setAllStates(ctx, logger, alertRule, results, eval.Normal, "No Data:"+results.NoData.String())
		case ngModels.Alerting:
			return st.setAllStates(ctx, logger, alertRule, results, eval.Alerting, "No Data:"+results.NoData.String())
		case ngModels.NoData:
			if results.NoData.DatasourceToRefID != nil {
				transitions := make([]StateTransition, 0, len(results.NoData.DatasourceToRefID))
				for datasourceUID, refIDs := range results.NoData.DatasourceToRefID {
					r := eval.Result{
						Instance: data.Labels{
							"datasource_uid": datasourceUID,
							"ref_id":         strings.Join(refIDs, ","),
						},
						State:              eval.NoData,
						EvaluatedAt:        results.EvaluatedAt,
						EvaluationDuration: results.EvaluationDuration,
					}
					s := st.cache.getOrCreate(ctx, st.log, alertRule, r, extraLabels, st.externalURL)
					transition := setNextState(ctx, logger, st.images, alertRule, r, s, "")
					st.cache.set(transition.State)
					transitions = append(transitions, transition)
				}
				return transitions
			}
			r := eval.Result{
				State:              eval.NoData,
				EvaluatedAt:        results.EvaluatedAt,
				EvaluationDuration: results.EvaluationDuration,
			}
			s := st.cache.getOrCreate(ctx, st.log, alertRule, r, extraLabels, st.externalURL)
			transition := setNextState(ctx, logger, st.images, alertRule, r, s, "")
			st.cache.set(transition.State)
			return []StateTransition{transition}
		}
	}
	logger.Debug("State manager processing evaluation results", "results", len(results.Results))

	transitions := make([]StateTransition, 0, len(results.Results))
	for _, result := range results.Results {
		currentState := st.cache.getOrCreate(ctx, st.log, alertRule, result, extraLabels, st.externalURL)
		transition := setNextState(ctx, logger, st.images, alertRule, result, currentState, "")
		st.cache.set(transition.State)
		transitions = append(transitions, transition)
	}
	return transitions
}

func (st *Manager) setAllStates(ctx context.Context, logger log.Logger, alertRule *ngModels.AlertRule, result eval.EvaluationResult, newState eval.State, stateReason string) []StateTransition {
	states := st.cache.getStatesForRuleUID(alertRule.OrgID, alertRule.UID)
	transitions := make([]StateTransition, 0, len(states))
	for _, state := range states {
		r := eval.Result{
			Instance:           state.Labels,
			State:              newState,
			EvaluatedAt:        result.EvaluatedAt,
			EvaluationDuration: result.EvaluationDuration,
		}
		transition := setNextState(ctx, logger, st.images, alertRule, r, state, stateReason)
		st.cache.set(transition.State)
		transitions = append(transitions, transition)
	}
	return transitions
}

// Set the current state based on evaluation results
func setNextState(ctx context.Context, logger log.Logger, images ImageCapturer, alertRule *ngModels.AlertRule, result eval.Result, currentState *State, newStateReason string) StateTransition {
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
	oldReason := currentState.StateReason

	// Add the instance to the log context to help correlate log lines for a state
	logger = logger.New("instance", result.Instance)

	switch result.State {
	case eval.Normal:
		logger.Debug("Setting next state", "handler", "resultNormal")
		resultNormal(currentState, alertRule, result, logger)
	case eval.Alerting:
		logger.Debug("Setting next state", "handler", "resultAlerting")
		resultAlerting(currentState, alertRule, result, logger)
	case eval.Error:
		logger.Debug("Setting next state", "handler", "resultError")
		resultError(currentState, alertRule, result, logger)
	case eval.NoData:
		logger.Debug("Setting next state", "handler", "resultNoData")
		resultNoData(currentState, alertRule, result, logger)
	case eval.Pending: // we do not emit results with this state
		logger.Debug("Ignoring set next state as result is pending")
	}
	currentState.StateReason = newStateReason

	if currentState.State != result.State &&
		result.State != eval.Normal &&
		result.State != eval.Alerting && newStateReason == "" {
		currentState.StateReason = result.State.String()
	}

	// Set Resolved property so the scheduler knows to send a postable alert
	// to Alertmanager.
	currentState.Resolved = oldState == eval.Alerting && currentState.State == eval.Normal

	if shouldTakeImage(currentState.State, oldState, currentState.Image, currentState.Resolved) {
		image, err := takeImage(ctx, images, alertRule)
		if err != nil {
			logger.Warn("Failed to take an image",
				"dashboard", alertRule.GetDashboardUID(),
				"panel", alertRule.GetPanelID(),
				"error", err)
		} else if image != nil {
			currentState.Image = image
		}
	}

	nextState := StateTransition{
		State:               currentState,
		PreviousState:       oldState,
		PreviousStateReason: oldReason,
	}

	return nextState
}

func (st *Manager) GetAll(orgID int64) []*State {
	return st.cache.getAll(orgID)
}

func (st *Manager) GetStatesForRuleUID(orgID int64, alertRuleUID string) []*State {
	return st.cache.getStatesForRuleUID(orgID, alertRuleUID)
}

func (st *Manager) Put(states []*State) {
	for _, s := range states {
		st.cache.set(s)
	}
}

// TODO: Is the `State` type necessary? Should it embed the instance?
func (st *Manager) saveAlertStates(ctx context.Context, logger log.Logger, states ...StateTransition) {
	if st.instanceStore == nil || len(states) == 0 {
		return
	}

	logger.Debug("Saving alert states", "count", len(states))
	instances := make([]ngModels.AlertInstance, 0, len(states))

	for _, s := range states {
		key, err := s.GetAlertInstanceKey()
		if err != nil {
			logger.Error("Failed to create a key for alert state to save it to database. The state will be ignored ", "cacheID", s.CacheID, "error", err)
			continue
		}
		fields := ngModels.AlertInstance{
			AlertInstanceKey:  key,
			Labels:            ngModels.InstanceLabels(s.Labels),
			CurrentState:      ngModels.InstanceStateType(s.State.State.String()),
			CurrentReason:     s.StateReason,
			LastEvalTime:      s.LastEvaluationTime,
			CurrentStateSince: s.StartsAt,
			CurrentStateEnd:   s.EndsAt,
		}
		instances = append(instances, fields)
	}

	if err := st.instanceStore.SaveAlertInstances(ctx, instances...); err != nil {
		type debugInfo struct {
			State  string
			Labels string
		}
		debug := make([]debugInfo, 0)
		for _, inst := range instances {
			debug = append(debug, debugInfo{string(inst.CurrentState), data.Labels(inst.Labels).String()})
		}
		logger.Error("Failed to save alert states", "states", debug, "error", err)
	}
}

func (st *Manager) deleteAlertStates(ctx context.Context, logger log.Logger, states []StateTransition) {
	if st.instanceStore == nil || len(states) == 0 {
		return
	}

	logger.Debug("Deleting alert states", "count", len(states))
	toDelete := make([]ngModels.AlertInstanceKey, 0, len(states))

	for _, s := range states {
		key, err := s.GetAlertInstanceKey()
		if err != nil {
			logger.Error("Failed to delete alert instance with invalid labels", "cacheID", s.CacheID, "error", err)
			continue
		}
		toDelete = append(toDelete, key)
	}

	err := st.instanceStore.DeleteAlertInstances(ctx, toDelete...)
	if err != nil {
		logger.Error("Failed to delete stale states", "error", err)
	}
}

// TODO: why wouldn't you allow other types like NoData or Error?
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

func (st *Manager) deleteStaleStatesFromCache(ctx context.Context, logger log.Logger, evaluatedAt time.Time, alertRule *ngModels.AlertRule) []StateTransition {
	// If we are removing two or more stale series it makes sense to share the resolved image as the alert rule is the same.
	// TODO: We will need to change this when we support images without screenshots as each series will have a different image
	var resolvedImage *ngModels.Image

	var resolvedStates []StateTransition
	staleStates := st.cache.deleteRuleStates(alertRule.GetKey(), func(s *State) bool {
		return stateIsStale(evaluatedAt, s.LastEvaluationTime, alertRule.IntervalSeconds)
	})

	for _, s := range staleStates {
		logger.Info("Detected stale state entry", "cacheID", s.CacheID, "state", s.State, "reason", s.StateReason)
		oldState := s.State
		oldReason := s.StateReason

		s.State = eval.Normal
		s.StateReason = ngModels.StateReasonMissingSeries
		s.EndsAt = evaluatedAt
		s.LastEvaluationTime = evaluatedAt

		if oldState == eval.Alerting {
			s.Resolved = true
			// If there is no resolved image for this rule then take one
			if resolvedImage == nil {
				image, err := takeImage(ctx, st.images, alertRule)
				if err != nil {
					logger.Warn("Failed to take an image",
						"dashboard", alertRule.GetDashboardUID(),
						"panel", alertRule.GetPanelID(),
						"error", err)
				} else if image != nil {
					resolvedImage = image
				}
			}
			s.Image = resolvedImage
		}

		record := StateTransition{
			State:               s,
			PreviousState:       oldState,
			PreviousStateReason: oldReason,
		}
		resolvedStates = append(resolvedStates, record)
	}
	return resolvedStates
}

func stateIsStale(evaluatedAt time.Time, lastEval time.Time, intervalSeconds int64) bool {
	return !lastEval.Add(2 * time.Duration(intervalSeconds) * time.Second).After(evaluatedAt)
}
