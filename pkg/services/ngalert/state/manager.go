package state

import (
	"bytes"
	"compress/zlib"
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/services/ngalert/state/pb"
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

	instanceStore InstanceDataStore
	images        ImageCapturer
	historian     Historian
	externalURL   *url.URL

	doNotSaveNormalState    bool
	maxStateSaveConcurrency int
}

type ManagerCfg struct {
	Metrics       *metrics.State
	ExternalURL   *url.URL
	InstanceStore InstanceDataStore
	Images        ImageCapturer
	Clock         clock.Clock
	Historian     Historian
	// DoNotSaveNormalState controls whether eval.Normal state is persisted to the database and returned by get methods
	DoNotSaveNormalState bool
	// MaxStateSaveConcurrency controls the number of goroutines (per rule) that can save alert state in parallel.
	MaxStateSaveConcurrency int
}

func NewManager(cfg ManagerCfg) *Manager {
	return &Manager{
		cache:                   newCache(),
		ResendDelay:             ResendDelay, // TODO: make this configurable
		log:                     log.New("ngalert.state.manager"),
		metrics:                 cfg.Metrics,
		instanceStore:           cfg.InstanceStore,
		images:                  cfg.Images,
		historian:               cfg.Historian,
		clock:                   cfg.Clock,
		externalURL:             cfg.ExternalURL,
		doNotSaveNormalState:    cfg.DoNotSaveNormalState,
		maxStateSaveConcurrency: cfg.MaxStateSaveConcurrency,
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
		st.log.Info("Skipping warming the state cache")
		return
	}

	start := time.Now()
	st.log.Info("Deleting expired instance data before warming")
	st.deleteOldInstanceData(ctx, st.log)
	st.log.Info("Deleting expired instance data before warming done", "duration", time.Since(start))

	start = time.Now()
	st.log.Info("Warming state cache")

	// Despite deleting expired state caches, there might be some states that have not expired
	// but their rules have been deleted. We'll create a lookup table of all known rules and
	// ignore alert instances that are not in this table.
	rulesForAllOrgs, err := rulesReader.ListAlertRules(ctx, &ngModels.ListAlertRulesQuery{})
	if err != nil {
		st.log.Error("Unable to fetch rules", "error", err)
		return
	}
	exists := make(map[ngModels.AlertRuleKey]struct{})
	for _, rule := range rulesForAllOrgs {
		exists[rule.GetKey()] = struct{}{}
	}

	// Next get all non-expired alert instance data to warm up the state cache
	alertInstanceData, err := st.instanceStore.ListAlertInstanceData(ctx, &ngModels.ListAlertInstancesQuery{})
	if err != nil {
		st.log.Error("Unable to fetch previous state", "error", err)
		return
	}

	states := make(map[int64]map[string]*ruleStates)
	for _, data := range alertInstanceData {
		alertInstances, err := unmarshalInstanceData(data)
		if err != nil {
			st.log.Error("Failed to unmarshal alert instance data", "error", err)
			continue
		}
		for _, next := range alertInstances {
			if _, ok := exists[ngModels.AlertRuleKey{OrgID: next.RuleOrgID, UID: next.RuleUID}]; !ok {
				st.log.Debug("Skipping alert instances for deleted rule", "org", next.RuleOrgID, "uid", next.RuleUID)
				continue
			}
			orgStates, ok := states[next.RuleOrgID]
			if !ok {
				orgStates = make(map[string]*ruleStates)
			}
			rulesStates, ok := orgStates[next.RuleUID]
			if !ok {
				rulesStates = &ruleStates{states: make(map[string]*State)}
				orgStates[next.RuleUID] = rulesStates
			}
			lbs := map[string]string(next.Labels)
			cacheID, err := next.Labels.StringKey()
			if err != nil {
				st.log.Error("Error getting cacheID for entry", "error", err)
			}
			rulesStates.states[cacheID] = &State{
				AlertRuleUID:         next.RuleUID,
				OrgID:                next.RuleOrgID,
				CacheID:              cacheID,
				Labels:               lbs,
				State:                translateInstanceState(next.CurrentState),
				StateReason:          next.CurrentReason,
				LastEvaluationString: "",
				StartsAt:             next.CurrentStateSince,
				EndsAt:               next.CurrentStateEnd,
				LastEvaluationTime:   next.LastEvalTime,
			}
			states[next.RuleOrgID] = orgStates
		}
	}
	st.cache.setAllStates(states)

	for _, rule := range rulesForAllOrgs {
		st.deleteStaleStatesFromCache(ctx, st.log, time.Now(), rule)
	}

	st.log.Info("Warming state cache done", "duration", time.Since(start))
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
		_, err := st.instanceStore.DeleteAlertInstanceData(ctx, ruleKey)
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
	logger := st.log.FromContext(ctx)
	logger.Debug("State manager processing evaluation results", "resultCount", len(results))
	states := make([]StateTransition, 0, len(results))

	for _, result := range results {
		s := st.setNextState(ctx, alertRule, result, extraLabels, logger)
		states = append(states, s)
	}
	staleStates := st.deleteStaleStatesFromCache(ctx, logger, evaluatedAt, alertRule)

	expiresAt := time.Now().Add((2 * time.Second) * time.Duration(alertRule.IntervalSeconds))
	st.saveAlertStates(ctx, logger, expiresAt, states...)
	st.deleteOldInstanceData(ctx, logger)

	allChanges := append(states, staleStates...)
	if st.historian != nil {
		st.historian.Record(ctx, history_model.NewRuleMeta(alertRule, logger), allChanges)
	}
	return allChanges
}

// Set the current state based on evaluation results
func (st *Manager) setNextState(ctx context.Context, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, logger log.Logger) StateTransition {
	currentState := st.cache.getOrCreate(ctx, logger, alertRule, result, extraLabels, st.externalURL)

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

// TODO: Is the `State` type necessary? Should it embed the instance?
func (st *Manager) saveAlertStates(ctx context.Context, logger log.Logger, expiresAt time.Time, states ...StateTransition) {
	if st.instanceStore == nil || len(states) == 0 {
		return
	}
	start := time.Now()
	logger.Debug("Saving alert states", "count", len(states))
	data, err := newInstanceData(states[0].GetRuleKey(), expiresAt, states)
	if err != nil {
		logger.Error("Failed to create instance data", "error", err)
		return
	}
	if err = st.instanceStore.SaveAlertInstanceData(ctx, *data); err != nil {
		logger.Error("Failed to save alert instance data", "error", err)
		return
	}
	logger.Debug("Saving alert states done", "count", len(states), "duration", time.Since(start))
}

func (st *Manager) deleteOldInstanceData(ctx context.Context, logger log.Logger) {
	if st.instanceStore == nil {
		return
	}
	deleted, err := st.instanceStore.DeleteExpiredAlertInstanceData(ctx)
	if err != nil {
		logger.Error("Failed to delete expired alert instance data", "error", err)
	} else {
		logger.Debug("Deleted alert instance data", "rows", deleted)
	}
}

func (st *Manager) deleteAlertStates(_ context.Context, logger log.Logger, states []StateTransition) {
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

func newInstanceData(key ngModels.AlertRuleKey, expiresAt time.Time, states []StateTransition) (*ngModels.AlertInstanceData, error) {
	p := &pb.AlertInstances{Instances: make([]*pb.AlertInstance, 0, len(states))}
	for _, state := range states {
		// Do not save normal state to database and remove transition to Normal state but keep mapped states
		if IsNormalStateWithNoReason(state.State) {
			continue
		}
		key, err := state.GetAlertInstanceKey()
		if err != nil {
			return nil, err
		}
		p.Instances = append(p.Instances, &pb.AlertInstance{
			Key: &pb.AlertInstance_AlertInstanceKey{
				RuleOrgId:  key.RuleOrgID,
				RuleUid:    key.RuleUID,
				LabelsHash: key.LabelsHash,
			},
			Labels:            state.Labels,
			CurrentState:      state.State.State.String(),
			CurrentReason:     state.State.StateReason,
			LastEvalTime:      timestamppb.New(state.LastEvaluationTime),
			CurrentStateSince: timestamppb.New(state.StartsAt),
			CurrentStateEnd:   timestamppb.New(state.EndsAt),
		})
	}

	out, err := proto.Marshal(p)
	if err != nil {
		return nil, fmt.Errorf("Failed to marshal protobuf: %w", err)
	}

	b := bytes.Buffer{}
	w := zlib.NewWriter(&b)
	if _, err := w.Write(out); err != nil {
		return nil, fmt.Errorf("Failed to write to zlib writer: %w", err)
	}
	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("Failed to close zlib writer: %w", err)
	}
	logger.Debug("Reduced size summary", "without_compression", len(out), "with_compression", b.Len())

	return &ngModels.AlertInstanceData{
		OrgID:     key.OrgID,
		RuleUID:   key.UID,
		Data:      b.Bytes(),
		ExpiresAt: expiresAt,
	}, nil
}

func unmarshalInstanceData(data *ngModels.AlertInstanceData) ([]*ngModels.AlertInstance, error) {
	result := make([]*ngModels.AlertInstance, 0)
	r, err := zlib.NewReader(bytes.NewReader(data.Data))
	if err != nil {
		return nil, fmt.Errorf("Failed to create zlib reader: %w", err)
	}
	b := bytes.Buffer{}
	if _, err := io.Copy(&b, r); err != nil {
		return nil, fmt.Errorf("Failed to copy from zlib: %w", err)
	}
	if err := r.Close(); err != nil {
		return nil, fmt.Errorf("Failed to close zlib reader: %w", err)
	}
	p := pb.AlertInstances{}
	if err := proto.Unmarshal(b.Bytes(), &p); err != nil {
		return nil, fmt.Errorf("Failed to unmarshal protobuf: %w", err)
	}
	for _, i := range p.Instances {
		v := ngModels.AlertInstance{
			AlertInstanceKey: ngModels.AlertInstanceKey{
				RuleOrgID:  i.Key.RuleOrgId,
				RuleUID:    i.Key.RuleUid,
				LabelsHash: i.Key.LabelsHash,
			},
			Labels:            i.Labels,
			CurrentState:      ngModels.InstanceStateType(i.CurrentState),
			CurrentReason:     i.CurrentReason,
			LastEvalTime:      i.LastEvalTime.AsTime(),
			CurrentStateSince: i.CurrentStateSince.AsTime(),
			CurrentStateEnd:   i.CurrentStateEnd.AsTime(),
		}
		result = append(result, &v)
	}
	return result, nil
}
