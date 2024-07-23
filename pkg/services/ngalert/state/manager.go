package state

import (
	"context"
	"net/url"
	"strconv"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

var (
	ResendDelay = 30 * time.Second
)

// AlertInstanceManager defines the interface for querying the current alert instances.
type AlertInstanceManager interface {
	GetAll(orgID int64) []*State
	GetStatesForRuleUID(orgID int64, alertRuleUID string) []*State
}

type StatePersister interface {
	Async(ctx context.Context, cache *cache)
	Sync(ctx context.Context, span trace.Span, states StateTransitions)
}

// Sender is an optional callback intended for sending the states to an alertmanager.
type Sender func(context.Context, StateTransitions)

type Manager struct {
	log     log.Logger
	metrics *metrics.State
	tracer  tracing.Tracer

	clock             clock.Clock
	cache             *cache
	ResendDelay       time.Duration
	ResolvedRetention time.Duration

	instanceStore InstanceStore
	images        ImageCapturer
	historian     Historian
	externalURL   *url.URL

	doNotSaveNormalState           bool
	applyNoDataAndErrorToAllStates bool
	rulesPerRuleGroupLimit         int64

	persister StatePersister
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
	RulesPerRuleGroupLimit         int64

	DisableExecution bool

	// Duration for which a resolved alert state transition will continue to be sent to the Alertmanager.
	ResolvedRetention time.Duration

	Tracer tracing.Tracer
	Log    log.Logger
}

func NewManager(cfg ManagerCfg, statePersister StatePersister) *Manager {
	// Metrics for the cache use a collector, so they need access to the register directly.
	c := newCache()
	// Only expose the metrics if this grafana server does execute alerts.
	if cfg.Metrics != nil && !cfg.DisableExecution {
		c.RegisterMetrics(cfg.Metrics.Registerer())
	}

	m := &Manager{
		cache:                          c,
		ResendDelay:                    ResendDelay, // TODO: make this configurable
		ResolvedRetention:              cfg.ResolvedRetention,
		log:                            cfg.Log,
		metrics:                        cfg.Metrics,
		instanceStore:                  cfg.InstanceStore,
		images:                         cfg.Images,
		historian:                      cfg.Historian,
		clock:                          cfg.Clock,
		externalURL:                    cfg.ExternalURL,
		doNotSaveNormalState:           cfg.DoNotSaveNormalState,
		applyNoDataAndErrorToAllStates: cfg.ApplyNoDataAndErrorToAllStates,
		rulesPerRuleGroupLimit:         cfg.RulesPerRuleGroupLimit,
		persister:                      statePersister,
		tracer:                         cfg.Tracer,
	}

	if m.applyNoDataAndErrorToAllStates {
		m.log.Info("Running in alternative execution of Error/NoData mode")
	}

	return m
}

func (st *Manager) Run(ctx context.Context) error {
	st.persister.Async(ctx, st.cache)
	return nil
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
		groupSizes := make(map[string]int64)
		for _, rule := range alertRules {
			ruleByUID[rule.UID] = rule
			groupSizes[rule.RuleGroup] += 1
		}

		// Emit a warning if we detect a large group.
		// We will not enforce this here, but it's convenient to emit the warning here as we load up all the rules.
		for name, size := range groupSizes {
			if st.rulesPerRuleGroupLimit > 0 && size > st.rulesPerRuleGroupLimit {
				st.log.Warn(
					"Large rule group was loaded. Large groups are discouraged and changes to them may be disallowed in the future.",
					"limit", st.rulesPerRuleGroupLimit,
					"actual", size,
					"group", name,
				)
			}
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
				rulesStates = &ruleStates{states: make(map[data.Fingerprint]*State)}
				orgStates[entry.RuleUID] = rulesStates
			}

			lbs := map[string]string(entry.Labels)
			cacheID := entry.Labels.Fingerprint()
			var resultFp data.Fingerprint
			if entry.ResultFingerprint != "" {
				fp, err := strconv.ParseUint(entry.ResultFingerprint, 16, 64)
				if err != nil {
					st.log.Error("Failed to parse result fingerprint of alert instance", "error", err, "ruleUID", entry.RuleUID)
				}
				resultFp = data.Fingerprint(fp)
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
				ResultFingerprint:    resultFp,
				ResolvedAt:           entry.ResolvedAt,
				LastSentAt:           entry.LastSentAt,
			}
			statesCount++
		}
	}

	st.cache.setAllStates(states)
	st.log.Info("State cache has been initialized", "states", statesCount, "duration", time.Since(startTime))
}

func (st *Manager) Get(orgID int64, alertRuleUID string, stateId data.Fingerprint) *State {
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
		if oldState == eval.Alerting || oldState == eval.Error || oldState == eval.NoData {
			s.ResolvedAt = &now
		} else {
			s.ResolvedAt = nil
		}
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
// This will update the states in cache/store and return the state transitions that need to be sent to the alertmanager.
func (st *Manager) ProcessEvalResults(
	ctx context.Context,
	evaluatedAt time.Time,
	alertRule *ngModels.AlertRule,
	results eval.Results,
	extraLabels data.Labels,
	send Sender,
) StateTransitions {
	utcTick := evaluatedAt.UTC().Format(time.RFC3339Nano)
	ctx, span := st.tracer.Start(ctx, "alert rule state calculation", trace.WithAttributes(
		attribute.String("rule_uid", alertRule.UID),
		attribute.Int64("org_id", alertRule.OrgID),
		attribute.Int64("rule_version", alertRule.Version),
		attribute.String("tick", utcTick),
		attribute.Int("results", len(results))))
	defer span.End()

	logger := st.log.FromContext(ctx)
	logger.Debug("State manager processing evaluation results", "resultCount", len(results))
	states := st.setNextStateForRule(ctx, alertRule, results, extraLabels, logger)

	staleStates := st.deleteStaleStatesFromCache(ctx, logger, evaluatedAt, alertRule)
	span.AddEvent("results processed", trace.WithAttributes(
		attribute.Int64("state_transitions", int64(len(states))),
		attribute.Int64("stale_states", int64(len(staleStates))),
	))

	allChanges := StateTransitions(append(states, staleStates...))

	// It's important that this is done *before* we sync the states to the persister. Otherwise, we will not persist
	// the LastSentAt field to the store.
	var statesToSend StateTransitions
	if send != nil {
		statesToSend = st.updateLastSentAt(allChanges, evaluatedAt)
	}

	st.persister.Sync(ctx, span, allChanges)
	if st.historian != nil {
		st.historian.Record(ctx, history_model.NewRuleMeta(alertRule, logger), allChanges)
	}

	// Optional callback intended for sending the states to an alertmanager.
	// Some uses ,such as backtesting or the testing api, do not send.
	if send != nil {
		send(ctx, statesToSend)
	}

	return allChanges
}

// updateLastSentAt returns the subset StateTransitions that need sending and updates their LastSentAt field.
// Note: This is not idempotent, running this twice can (and usually will) return different results.
func (st *Manager) updateLastSentAt(states StateTransitions, evaluatedAt time.Time) StateTransitions {
	var result StateTransitions
	for _, t := range states {
		if t.NeedsSending(st.ResendDelay, st.ResolvedRetention) {
			t.LastSentAt = &evaluatedAt
			result = append(result, t)
		}
	}
	return result
}

func (st *Manager) setNextStateForRule(ctx context.Context, alertRule *ngModels.AlertRule, results eval.Results, extraLabels data.Labels, logger log.Logger) []StateTransition {
	if st.applyNoDataAndErrorToAllStates && results.IsNoData() && (alertRule.NoDataState == ngModels.Alerting || alertRule.NoDataState == ngModels.OK || alertRule.NoDataState == ngModels.KeepLast) { // If it is no data, check the mapping and switch all results to the new state
		// TODO aggregate UID of datasources that returned NoData into one and provide as auxiliary info, probably annotation
		transitions := st.setNextStateForAll(ctx, alertRule, results[0], logger)
		if len(transitions) > 0 {
			return transitions // if there are no current states for the rule. Create ones for each result
		}
	}
	if st.applyNoDataAndErrorToAllStates && results.IsError() && (alertRule.ExecErrState == ngModels.AlertingErrState || alertRule.ExecErrState == ngModels.OkErrState || alertRule.ExecErrState == ngModels.KeepLastErrState) {
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
	currentState.SetNextValues(result)
	currentState.LatestResult = &Evaluation{
		EvaluationTime:  result.EvaluatedAt,
		EvaluationState: result.State,
		Values:          currentState.Values,
		Condition:       alertRule.Condition,
	}
	currentState.LastEvaluationString = result.EvaluationString
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
		resultNormal(currentState, alertRule, result, logger, "")
	case eval.Alerting:
		logger.Debug("Setting next state", "handler", "resultAlerting")
		resultAlerting(currentState, alertRule, result, logger, "")
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
		currentState.StateReason = resultStateReason(result, alertRule)
	}

	// Set Resolved property so the scheduler knows to send a postable alert
	// to Alertmanager.
	newlyResolved := false
	if oldState == eval.Alerting && currentState.State == eval.Normal {
		currentState.ResolvedAt = &result.EvaluatedAt
		newlyResolved = true
	} else if currentState.State != eval.Normal && currentState.State != eval.Pending { // Retain the last resolved time for Normal->Normal and Normal->Pending.
		currentState.ResolvedAt = nil
	}

	if shouldTakeImage(currentState.State, oldState, currentState.Image, newlyResolved) {
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

func resultStateReason(result eval.Result, rule *ngModels.AlertRule) string {
	if rule.ExecErrState == ngModels.KeepLastErrState || rule.NoDataState == ngModels.KeepLast {
		return ngModels.ConcatReasons(result.State.String(), ngModels.StateReasonKeepLast)
	}

	return result.State.String()
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
			s.ResolvedAt = &evaluatedAt
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
