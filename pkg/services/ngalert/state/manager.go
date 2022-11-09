package state

import (
	"context"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
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
	imageService  image.ImageService
	historian     Historian
	externalURL   *url.URL
}

func NewManager(metrics *metrics.State, externalURL *url.URL, instanceStore InstanceStore, imageService image.ImageService, clock clock.Clock, historian Historian) *Manager {
	return &Manager{
		cache:         newCache(),
		ResendDelay:   ResendDelay, // TODO: make this configurable
		log:           log.New("ngalert.state.manager"),
		metrics:       metrics,
		instanceStore: instanceStore,
		imageService:  imageService,
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
func (st *Manager) ProcessEvalResults(ctx context.Context, evaluatedAt time.Time, alertRule *ngModels.AlertRule, results eval.Results, extraLabels data.Labels) []*State {
	logger := st.log.FromContext(ctx)
	logger.Debug("State manager processing evaluation results", "resultCount", len(results))
	var states []StateTransition

	for _, result := range results {
		s := st.setNextState(ctx, alertRule, result, extraLabels, logger)
		states = append(states, s)
	}
	resolvedStates := st.staleResultsHandler(ctx, logger, alertRule, evaluatedAt)

	st.saveAlertStates(ctx, logger, states...)

	changedStates := make([]StateTransition, 0, len(states))
	for _, s := range states {
		if s.changed() {
			changedStates = append(changedStates, s)
		}
	}

	if st.historian != nil {
		st.historian.RecordStates(ctx, alertRule, changedStates)
	}

	deltas := append(states, resolvedStates...)
	nextStates := make([]*State, 0, len(states))
	for _, s := range deltas {
		nextStates = append(nextStates, s.State)
	}
	return nextStates
}

// Set the current state based on evaluation results
func (st *Manager) setNextState(ctx context.Context, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, logger log.Logger) StateTransition {
	currentState := st.cache.getOrCreate(ctx, st.log, alertRule, result, extraLabels, st.externalURL)

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

	logger.Debug("Setting alert state")
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

	// Set reason iff: result is different than state, reason is not Alerting or Normal
	currentState.StateReason = ""

	if currentState.State != result.State &&
		result.State != eval.Normal &&
		result.State != eval.Alerting {
		currentState.StateReason = result.State.String()
	}

	// Set Resolved property so the scheduler knows to send a postable alert
	// to Alertmanager.
	currentState.Resolved = oldState == eval.Alerting && currentState.State == eval.Normal

	if shouldTakeImage(currentState.State, oldState, currentState.Image, currentState.Resolved) {
		image, err := takeImage(ctx, st.imageService, alertRule)
		if err != nil {
			logger.Warn("Failed to take an image",
				"dashboard", alertRule.DashboardUID,
				"panel", alertRule.PanelID,
				"error", err)
		} else if image != nil {
			currentState.Image = image
		}
	}

	st.cache.set(currentState)

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
	if st.instanceStore == nil {
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

func (st *Manager) staleResultsHandler(ctx context.Context, logger log.Logger, r *ngModels.AlertRule, evaluatedAt time.Time) []StateTransition {
	var (
		// resolvedImage contains the image for all stale states that are resolved. The resolved image is shared between
		// all resolved states as the alert rule is the same. TODO: We will need to change this when we support images
		// without screenshots as each state will have a different image
		resolvedImage *ngModels.Image

		// resolvedStates contains the stale states that were resolved
		resolvedStates []StateTransition

		// staleStates contains the current set of stale states from the state cache
		staleStates []*State

		// toDelete contains the stale states to delete
		toDelete []ngModels.AlertInstanceKey
	)

	staleStates = st.cache.deleteRuleStates(r.GetKey(), func(s *State) bool {
		return stateIsStale(evaluatedAt, s.LastEvaluationTime, r.IntervalSeconds)
	})

	for _, s := range staleStates {
		logger.Info("Detected stale state entry", "cacheID", s.CacheID, "state", s.State, "reason", s.StateReason)

		key, err := s.GetAlertInstanceKey()
		if err != nil {
			logger.Error("Unable to get alert instance key to delete it from database. Ignoring", "error", err)
		} else {
			toDelete = append(toDelete, key)
		}

		// If the stale state is alerting then it should first be resolved
		if s.State == eval.Alerting {
			t := StateTransition{PreviousState: s.State, PreviousStateReason: s.StateReason}
			s.Resolve(ngModels.StateReasonMissingSeries, evaluatedAt)
			s.LastEvaluationTime = evaluatedAt

			// If there is no resolved image for this rule then take one
			if resolvedImage == nil {
				image, err := takeImage(ctx, st.imageService, r)
				if err != nil {
					logger.Warn("Failed to take an image",
						"dashboard", r.DashboardUID,
						"panel", r.PanelID,
						"error", err)
				} else if image != nil {
					resolvedImage = image
				}
			}
			s.Image = resolvedImage

			t.State = s
			resolvedStates = append(resolvedStates, t)
		}
	}

	if st.historian != nil {
		st.historian.RecordStates(ctx, r, resolvedStates)
	}

	if st.instanceStore != nil {
		if err := st.instanceStore.DeleteAlertInstances(ctx, toDelete...); err != nil {
			logger.Error("Unable to delete stale instances from database", "error", err, "count", len(toDelete))
		}
	}

	return resolvedStates
}

func stateIsStale(evaluatedAt time.Time, lastEval time.Time, intervalSeconds int64) bool {
	return !lastEval.Add(2 * time.Duration(intervalSeconds) * time.Second).After(evaluatedAt)
}
