package state

import (
	"context"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
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
	tracer  tracing.Tracer

	clock       clock.Clock
	cache       *cache
	ResendDelay time.Duration

	instanceStore InstanceStore
	images        ImageCapturer
	historian     Historian
	externalURL   *url.URL

	doNotSaveNormalState           bool
	maxStateSaveConcurrency        int
	applyNoDataAndErrorToAllStates bool

	stateQueue chan StateTransition
}

type ManagerCfg struct {
	Metrics       *metrics.State
	ExternalURL   *url.URL
	InstanceStore InstanceStore
	Images        ImageCapturer
	Clock         clock.Clock
	Historian     Historian
	// DoNotSaveNormalState controls whether eval.Normal state is persisted to the database and returned by get methods
	DoNotSaveNormalState bool
	// MaxStateSaveConcurrency controls the number of goroutines (per rule) that can save alert state in parallel.
	MaxStateSaveConcurrency int

	// ApplyNoDataAndErrorToAllStates makes state manager to apply exceptional results (NoData and Error)
	// to all states when corresponding execution in the rule definition is set to either `Alerting` or `OK`
	ApplyNoDataAndErrorToAllStates bool

	Tracer tracing.Tracer
}

func NewManager(cfg ManagerCfg) *Manager {
	return &Manager{
		cache:                          newCache(),
		ResendDelay:                    ResendDelay, // TODO: make this configurable
		log:                            log.New("ngalert.state.manager"),
		metrics:                        cfg.Metrics,
		instanceStore:                  cfg.InstanceStore,
		images:                         cfg.Images,
		historian:                      cfg.Historian,
		clock:                          cfg.Clock,
		externalURL:                    cfg.ExternalURL,
		doNotSaveNormalState:           cfg.DoNotSaveNormalState,
		maxStateSaveConcurrency:        cfg.MaxStateSaveConcurrency,
		applyNoDataAndErrorToAllStates: cfg.ApplyNoDataAndErrorToAllStates,
		tracer:                         cfg.Tracer,
		stateQueue:                     make(chan StateTransition, 1000),
	}
}

func (st *Manager) Run(ctx context.Context) error {
	if st.applyNoDataAndErrorToAllStates {
		st.log.Info("Running in alternative execution of Error/NoData mode")
	}
	st.startQueueProcessor(ctx, st.log)
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

func (st *Manager) startQueueProcessor(ctx context.Context, logger log.Logger) {
	workers := st.maxStateSaveConcurrency
	if workers < 1 {
		workers = 1
	}
	for i := 0; i < workers; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case state, ok := <-st.stateQueue:
					if !ok {
						return
					}
					st.saveStateInStore(ctx, logger, state)
				}
			}
		}()
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
		alertRules, err := rulesReader.ListAlertRules(ctx, &ruleCmd)
		if err != nil {
			st.log.Error("Unable to fetch previous state", "error", err)
		}

		ruleByUID := make(map[string]*ngModels.AlertRule, len(alertRules))
		for _, rule := range alertRules {
			ruleByUID[rule.UID] = rule
		}

		orgStates := make(map[string]*ruleStates, len(ruleByUID))
		states[orgId] = orgStates

		// Get Instances
		cmd := ngModels.ListAlertInstancesQuery{
			RuleOrgID: orgId,
		}
		alertInstances, err := st.instanceStore.ListAlertInstances(ctx, &cmd)
		if err != nil {
			st.log.Error("Unable to fetch previous state", "error", err)
		}

		for _, entry := range alertInstances {
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

// DeleteStateByRuleUID removes the rule instances from cache and instanceStore. A closed channel is returned to be able
// to gracefully handle the clear state step in scheduler in case we do not need to use the historian to save state
// history.
func (st *Manager) DeleteStateByRuleUID(ctx context.Context, ruleKey ngModels.AlertRuleKey, reason string) []StateTransition {
	logger := st.log.FromContext(ctx)
	logger.Debug("Resetting state of the rule")

	states := st.cache.removeByRuleUID(ruleKey.OrgID, ruleKey.UID)

	if len(states) == 0 {
		return nil
	}

	now := st.clock.Now()
	transitions := make([]StateTransition, 0, len(states))
	for _, s := range states {
		oldState := s.State
		oldReason := s.StateReason
		startsAt := s.StartsAt
		if s.State != eval.Normal {
			startsAt = now
		}
		s.SetNormal(reason, startsAt, now)
		// Set Resolved property so the scheduler knows to send a postable alert
		// to Alertmanager.
		s.Resolved = oldState == eval.Alerting
		s.LastEvaluationTime = now
		s.Values = map[string]float64{}
		transitions = append(transitions, StateTransition{
			State:               s,
			PreviousState:       oldState,
			PreviousStateReason: oldReason,
		})
	}

	if st.instanceStore != nil {
		err := st.instanceStore.DeleteAlertInstancesByRule(ctx, ruleKey)
		if err != nil {
			logger.Error("Failed to delete states that belong to a rule from database", "error", err)
		}
	}
	logger.Info("Rules state was reset", "states", len(states))

	return transitions
}

// ResetStateByRuleUID removes the rule instances from cache and instanceStore and saves state history. If the state
// history has to be saved, rule must not be nil.
func (st *Manager) ResetStateByRuleUID(ctx context.Context, rule *ngModels.AlertRule, reason string) []StateTransition {
	ruleKey := rule.GetKey()
	transitions := st.DeleteStateByRuleUID(ctx, ruleKey, reason)

	if rule == nil || st.historian == nil || len(transitions) == 0 {
		return transitions
	}

	ruleMeta := history_model.NewRuleMeta(rule, st.log)
	errCh := st.historian.Record(ctx, ruleMeta, transitions)
	go func() {
		err := <-errCh
		if err != nil {
			st.log.FromContext(ctx).Error("Error updating historian state reset transitions", append(ruleKey.LogContext(), "reason", reason, "error", err)...)
		}
	}()
	return transitions
}

// ProcessEvalResults updates the current states that belong to a rule with the evaluation results.
// if extraLabels is not empty, those labels will be added to every state. The extraLabels take precedence over rule labels and result labels
func (st *Manager) ProcessEvalResults(ctx context.Context, evaluatedAt time.Time, alertRule *ngModels.AlertRule, results eval.Results, extraLabels data.Labels) []StateTransition {
	tracingCtx, span := st.tracer.Start(ctx, "alert rule state calculation")
	defer span.End()
	span.SetAttributes("rule_uid", alertRule.UID, attribute.String("rule_uid", alertRule.UID))
	span.SetAttributes("org_id", alertRule.OrgID, attribute.Int64("org_id", alertRule.OrgID))
	span.SetAttributes("rule_version", alertRule.Version, attribute.Int64("rule_version", alertRule.Version))
	utcTick := evaluatedAt.UTC().Format(time.RFC3339Nano)
	span.SetAttributes("tick", utcTick, attribute.String("tick", utcTick))
	span.SetAttributes("results", len(results), attribute.Int("tick", len(results)))

	logger := st.log.FromContext(tracingCtx)
	logger.Debug("State manager processing evaluation results", "resultCount", len(results))
	states := st.setNextStateForRule(tracingCtx, alertRule, results, extraLabels, logger)

	span.AddEvents([]string{"message", "state_transitions"},
		[]tracing.EventValue{
			{Str: "results processed"},
			{Num: int64(len(states))},
		})

	staleStates := st.deleteStaleStatesFromCache(ctx, logger, evaluatedAt, alertRule)
	st.deleteAlertStates(tracingCtx, logger, staleStates)

	if len(staleStates) > 0 {
		span.AddEvents([]string{"message", "state_transitions"},
			[]tracing.EventValue{
				{Str: "deleted stale states"},
				{Num: int64(len(staleStates))},
			})
	}

	st.saveAlertStates(states...)

	span.AddEvents([]string{"message"},
		[]tracing.EventValue{
			{Str: "updated database"},
		})

	allChanges := append(states, staleStates...)
	if st.historian != nil {
		st.historian.Record(tracingCtx, history_model.NewRuleMeta(alertRule, logger), allChanges)
	}
	return allChanges
}

func (st *Manager) setNextStateForRule(ctx context.Context, alertRule *ngModels.AlertRule, results eval.Results, extraLabels data.Labels, logger log.Logger) []StateTransition {
	if st.applyNoDataAndErrorToAllStates && results.IsNoData() && (alertRule.NoDataState == ngModels.Alerting || alertRule.NoDataState == ngModels.OK) { // If it is no data, check the mapping and switch all results to the new state
		// TODO aggregate UID of datasources that returned NoData into one and provide as auxiliary info, probably annotation
		transitions := st.setNextStateForAll(ctx, alertRule, results[0], logger)
		if len(transitions) > 0 {
			return transitions // if there are no current states for the rule. Create ones for each result
		}
	}
	if st.applyNoDataAndErrorToAllStates && results.IsError() && (alertRule.ExecErrState == ngModels.AlertingErrState || alertRule.ExecErrState == ngModels.OkErrState) {
		// TODO squash all errors into one, and provide as annotation
		transitions := st.setNextStateForAll(ctx, alertRule, results[0], logger)
		if len(transitions) > 0 {
			return transitions // if there are no current states for the rule. Create ones for each result
		}
	}
	transitions := make([]StateTransition, 0, len(results))
	for _, result := range results {
		currentState := st.cache.getOrCreate(ctx, logger, alertRule, result, extraLabels, st.externalURL)
		s := st.setNextState(ctx, alertRule, currentState, result, logger)
		transitions = append(transitions, s)
	}
	return transitions
}

func (st *Manager) setNextStateForAll(ctx context.Context, alertRule *ngModels.AlertRule, result eval.Result, logger log.Logger) []StateTransition {
	currentStates := st.cache.getStatesForRuleUID(alertRule.OrgID, alertRule.UID, false)
	transitions := make([]StateTransition, 0, len(currentStates))
	for _, currentState := range currentStates {
		t := st.setNextState(ctx, alertRule, currentState, result, logger)
		transitions = append(transitions, t)
	}
	return transitions
}

// Set the current state based on evaluation results
func (st *Manager) setNextState(ctx context.Context, alertRule *ngModels.AlertRule, currentState *State, result eval.Result, logger log.Logger) StateTransition {
	start := st.clock.Now()
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

	// if the current state is Error but the result is different, then we need o clean up the extra labels
	// that were added after the state key was calculated
	// https://github.com/grafana/grafana/blob/1df4d332c982dc5e394201bb2ef35b442727ce63/pkg/services/ngalert/state/state.go#L298-L311
	// Usually, it happens in the case of classic conditions when the evalResult does not have labels.
	//
	// This is temporary change to make sure that the labels are not persistent in the state after it was in Error state
	// TODO yuri. Remove it when correct Error result with labels is provided
	if currentState.State == eval.Error && result.State != eval.Error {
		// This is possible because state was updated after the CacheID was calculated.
		_, curOk := currentState.Labels["ref_id"]
		_, resOk := result.Instance["ref_id"]
		if curOk && !resOk {
			delete(currentState.Labels, "ref_id")
		}
		_, curOk = currentState.Labels["datasource_uid"]
		_, resOk = result.Instance["datasource_uid"]
		if curOk && !resOk {
			delete(currentState.Labels, "datasource_uid")
		}
	}

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

	// Set reason iff: result and state are different, reason is not Alerting or Normal
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
		image, err := takeImage(ctx, st.images, alertRule)
		if err != nil {
			logger.Warn("Failed to take an image",
				"dashboard", alertRule.GetDashboardUID(),
				"panel", alertRule.GetPanelID(),
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

	if st.metrics != nil {
		st.metrics.StateUpdateDuration.Observe(st.clock.Now().Sub(start).Seconds())
	}

	return nextState
}

func (st *Manager) GetAll(orgID int64) []*State {
	allStates := st.cache.getAll(orgID, st.doNotSaveNormalState)
	return allStates
}
func (st *Manager) GetStatesForRuleUID(orgID int64, alertRuleUID string) []*State {
	return st.cache.getStatesForRuleUID(orgID, alertRuleUID, st.doNotSaveNormalState)
}

func (st *Manager) Put(states []*State) {
	for _, s := range states {
		st.cache.set(s)
	}
}

func (st *Manager) saveAlertStates(states ...StateTransition) {
	if st.instanceStore == nil || len(states) == 0 {
		return
	}
	for _, state := range states {
		st.stateQueue <- state
	}
}

func (st *Manager) saveStateInStore(ctx context.Context, logger log.Logger, s StateTransition) {
	// Do not save normal state to database and remove transition to Normal state but keep mapped states
	if st.doNotSaveNormalState && IsNormalStateWithNoReason(s.State) && !s.Changed() {
		return
	}

	key, err := s.GetAlertInstanceKey()
	if err != nil {
		logger.Error("Failed to create a key for alert state to save it to database. The state will be ignored ", "cacheID", s.CacheID, "error", err, "labels", s.Labels.String())
		return
	}
	instance := ngModels.AlertInstance{
		AlertInstanceKey:  key,
		Labels:            ngModels.InstanceLabels(s.Labels),
		CurrentState:      ngModels.InstanceStateType(s.State.State.String()),
		CurrentReason:     s.StateReason,
		LastEvalTime:      s.LastEvaluationTime,
		CurrentStateSince: s.StartsAt,
		CurrentStateEnd:   s.EndsAt,
	}

	err = st.instanceStore.SaveAlertInstance(ctx, instance)
	if err != nil {
		logger.Error("Failed to save alert state", "labels", s.Labels.String(), "state", s.State, "error", err)
		return
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

func translateInstanceState(state ngModels.InstanceStateType) eval.State {
	switch state {
	case ngModels.InstanceStateFiring:
		return eval.Alerting
	case ngModels.InstanceStateNormal:
		return eval.Normal
	case ngModels.InstanceStateError:
		return eval.Error
	case ngModels.InstanceStateNoData:
		return eval.NoData
	case ngModels.InstanceStatePending:
		return eval.Pending
	default:
		return eval.Error
	}
}

func (st *Manager) deleteStaleStatesFromCache(ctx context.Context, logger log.Logger, evaluatedAt time.Time, alertRule *ngModels.AlertRule) []StateTransition {
	// If we are removing two or more stale series it makes sense to share the resolved image as the alert rule is the same.
	// TODO: We will need to change this when we support images without screenshots as each series will have a different image
	staleStates := st.cache.deleteRuleStates(alertRule.GetKey(), func(s *State) bool {
		return stateIsStale(evaluatedAt, s.LastEvaluationTime, alertRule.IntervalSeconds)
	})
	resolvedStates := make([]StateTransition, 0, len(staleStates))

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
			image, err := takeImage(ctx, st.images, alertRule)
			if err != nil {
				logger.Warn("Failed to take an image",
					"dashboard", alertRule.GetDashboardUID(),
					"panel", alertRule.GetPanelID(),
					"error", err)
			} else if image != nil {
				s.Image = image
			}
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
