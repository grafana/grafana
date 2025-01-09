package state

import (
	"context"
	"net/url"
	"strconv"
	"strings"
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
	Async(ctx context.Context, instancesProvider AlertInstancesProvider)
	Sync(ctx context.Context, span trace.Span, ruleKey ngModels.AlertRuleKeyWithGroup, states StateTransitions)
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
	// StatePeriodicSaveBatchSize controls the size of the alert instance batch that is saved periodically when the
	// alertingSaveStatePeriodic feature flag is enabled.
	StatePeriodicSaveBatchSize int
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

func (st *Manager) Warm(ctx context.Context, rulesReader RuleReader, instanceReader InstanceReader) {
	logger := st.log.FromContext(ctx)

	if st.instanceStore == nil {
		logger.Info("Skip warming the state because instance store is not configured")
		return
	}

	startTime := time.Now()
	logger.Info("Warming state cache for startup")

	orgIds, err := instanceReader.FetchOrgIds(ctx)
	if err != nil {
		logger.Error("Unable to fetch orgIds", "error", err)
	}

	statesCount := 0
	for _, orgId := range orgIds {
		// Get Rules
		ruleCmd := ngModels.ListAlertRulesQuery{
			OrgID: orgId,
		}
		alertRules, err := rulesReader.ListAlertRules(ctx, &ruleCmd)
		if err != nil {
			logger.Error("Unable to fetch previous state", "error", err)
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
				logger.Warn(
					"Large rule group was loaded. Large groups are discouraged and changes to them may be disallowed in the future.",
					"limit", st.rulesPerRuleGroupLimit,
					"actual", size,
					"group", name,
				)
			}
		}

		// Get Instances
		cmd := ngModels.ListAlertInstancesQuery{
			RuleOrgID: orgId,
		}
		alertInstances, err := instanceReader.ListAlertInstances(ctx, &cmd)
		if err != nil {
			logger.Error("Unable to fetch previous state", "error", err)
		}

		for _, entry := range alertInstances {
			ruleForEntry, ok := ruleByUID[entry.RuleUID]
			if !ok {
				// TODO Should we delete the orphaned state from the db?
				continue
			}

			// nil safety.
			annotations := ruleForEntry.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			lbs := map[string]string(entry.Labels)
			cacheID := entry.Labels.Fingerprint()
			var resultFp data.Fingerprint
			if entry.ResultFingerprint != "" {
				fp, err := strconv.ParseUint(entry.ResultFingerprint, 16, 64)
				if err != nil {
					logger.Error("Failed to parse result fingerprint of alert instance", "error", err, "ruleUID", entry.RuleUID)
				}
				resultFp = data.Fingerprint(fp)
			}
			state := &State{
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
				Annotations:          annotations,
				ResultFingerprint:    resultFp,
				ResolvedAt:           entry.ResolvedAt,
				LastSentAt:           entry.LastSentAt,
			}
			st.cache.set(state)
			statesCount++
		}
	}

	logger.Info("State cache has been initialized", "states", statesCount, "duration", time.Since(startTime))
}

func (st *Manager) Get(orgID int64, alertRuleUID string, stateId data.Fingerprint) *State {
	return st.cache.get(orgID, alertRuleUID, stateId)
}

// DeleteStateByRuleUID removes the rule instances from cache and instanceStore. A closed channel is returned to be able
// to gracefully handle the clear state step in scheduler in case we do not need to use the historian to save state
// history.
func (st *Manager) DeleteStateByRuleUID(ctx context.Context, ruleKey ngModels.AlertRuleKeyWithGroup, reason string) []StateTransition {
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
	ruleKey := rule.GetKeyWithGroup()
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

	// lazy evaluation of takeImage only once and only if it is requested.
	var fn func() *ngModels.Image
	{
		var image *ngModels.Image
		var imageTaken bool
		fn = func() *ngModels.Image {
			if imageTaken {
				return image
			}
			logger.Debug("Taking image", "dashboard", alertRule.GetDashboardUID(), "panel", alertRule.GetPanelID())
			img, err := takeImage(ctx, st.images, alertRule)
			imageTaken = true
			if err != nil {
				logger.Warn("Failed to take an image",
					"dashboard", alertRule.GetDashboardUID(),
					"panel", alertRule.GetPanelID(),
					"error", err)
				return nil
			}
			image = img
			return image
		}
	}

	logger.Debug("State manager processing evaluation results", "resultCount", len(results))
	states := st.setNextStateForRule(ctx, alertRule, results, extraLabels, logger, fn)

	staleStates := st.deleteStaleStatesFromCache(logger, evaluatedAt, alertRule, fn)
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

	st.persister.Sync(ctx, span, alertRule.GetKeyWithGroup(), allChanges)
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

func (st *Manager) setNextStateForRule(ctx context.Context, alertRule *ngModels.AlertRule, results eval.Results, extraLabels data.Labels, logger log.Logger, takeImageFn func() *ngModels.Image) []StateTransition {
	if st.applyNoDataAndErrorToAllStates && results.IsNoData() && (alertRule.NoDataState == ngModels.Alerting || alertRule.NoDataState == ngModels.OK || alertRule.NoDataState == ngModels.KeepLast) { // If it is no data, check the mapping and switch all results to the new state
		// aggregate UID of datasources that returned NoData into one and provide as auxiliary info via annotationa. See: https://github.com/grafana/grafana/issues/88184
		var refIds strings.Builder
		var datasourceUIDs strings.Builder
		// for deduplication of datasourceUIDs
		dsUIDSet := make(map[string]bool)
		for i, result := range results {
			if refid, ok := result.Instance["ref_id"]; ok {
				if i > 0 {
					refIds.WriteString(",")
				}
				refIds.WriteString(refid)
			}
			if dsUID, ok := result.Instance["datasource_uid"]; ok {
				if !dsUIDSet[dsUID] {
					if i > 0 {
						refIds.WriteString(",")
					}
					datasourceUIDs.WriteString(dsUID)
					dsUIDSet[dsUID] = true
				}
			}
		}
		annotations := map[string]string{
			"datasource_uid": datasourceUIDs.String(),
			"ref_id":         refIds.String(),
		}
		transitions := st.setNextStateForAll(alertRule, results[0], logger, annotations, takeImageFn)
		if len(transitions) > 0 {
			return transitions // if there are no current states for the rule. Create ones for each result
		}
	}
	if st.applyNoDataAndErrorToAllStates && results.IsError() && (alertRule.ExecErrState == ngModels.AlertingErrState || alertRule.ExecErrState == ngModels.OkErrState || alertRule.ExecErrState == ngModels.KeepLastErrState) {
		// TODO squash all errors into one, and provide as annotation
		transitions := st.setNextStateForAll(alertRule, results[0], logger, nil, takeImageFn)
		if len(transitions) > 0 {
			return transitions // if there are no current states for the rule. Create ones for each result
		}
	}
	transitions := make([]StateTransition, 0, len(results))
	for _, result := range results {
		currentState := st.cache.create(ctx, logger, alertRule, result, extraLabels, st.externalURL)
		s := st.setNextState(alertRule, currentState, result, nil, logger, takeImageFn)
		st.cache.set(currentState) // replace the existing state with the new one
		transitions = append(transitions, s)
	}
	return transitions
}

func (st *Manager) setNextStateForAll(alertRule *ngModels.AlertRule, result eval.Result, logger log.Logger, extraAnnotations data.Labels, takeImageFn func() *ngModels.Image) []StateTransition {
	currentStates := st.cache.getStatesForRuleUID(alertRule.OrgID, alertRule.UID, false)
	transitions := make([]StateTransition, 0, len(currentStates))
	updated := ruleStates{
		states: make(map[data.Fingerprint]*State, len(currentStates)),
	}
	for _, currentState := range currentStates {
		newState := currentState.Copy()
		t := st.setNextState(alertRule, newState, result, extraAnnotations, logger, takeImageFn)
		updated.states[newState.CacheID] = newState
		transitions = append(transitions, t)
	}
	st.cache.setRuleStates(alertRule.GetKey(), updated)
	return transitions
}

// Set the current state based on evaluation results
func (st *Manager) setNextState(alertRule *ngModels.AlertRule, currentState *State, result eval.Result, extraAnnotations data.Labels, logger log.Logger, takeImageFn func() *ngModels.Image) StateTransition {
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
		image := takeImageFn()
		if image != nil {
			currentState.Image = image
		}
	}

	for key, val := range extraAnnotations {
		currentState.Annotations[key] = val
	}

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

func (st *Manager) GetStatusForRuleUID(orgID int64, alertRuleUID string) ngModels.RuleStatus {
	states := st.GetStatesForRuleUID(orgID, alertRuleUID)
	return StatesToRuleStatus(states)
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

func (st *Manager) deleteStaleStatesFromCache(logger log.Logger, evaluatedAt time.Time, alertRule *ngModels.AlertRule, takeImageFn func() *ngModels.Image) []StateTransition {
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
			image := takeImageFn()
			if image != nil {
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

func StatesToRuleStatus(states []*State) ngModels.RuleStatus {
	status := ngModels.RuleStatus{
		Health:              "ok",
		LastError:           nil,
		EvaluationTimestamp: time.Time{},
	}
	for _, state := range states {
		if state.LastEvaluationTime.After(status.EvaluationTimestamp) {
			status.EvaluationTimestamp = state.LastEvaluationTime
		}

		status.EvaluationDuration = state.EvaluationDuration

		switch state.State {
		case eval.Normal:
		case eval.Pending:
		case eval.Alerting:
		case eval.Error:
			status.Health = "error"
		case eval.NoData:
			status.Health = "nodata"
		}

		if state.Error != nil {
			status.LastError = state.Error
			status.Health = "error"
		}
	}
	return status
}
