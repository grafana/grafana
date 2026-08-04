// Package status persists rule-level status (state/health/reason) onto the
// app-platform AlertRule/RecordingRule resources by writing the alert_rule.k8s_status
// column.
package status

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

// RuleStore lists rules to sync and persists their status. Satisfied by *store.DBstore.
type RuleStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
	ListAlertRules(ctx context.Context, q *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error)
	SaveAlertRuleStatus(ctx context.Context, orgID int64, ruleUID string, data []byte) error
}

// StateReader provides per-rule instance states, used to compute alert-rule status.
// Satisfied by state.AlertInstanceManager (ng.Api.StateManager).
type StateReader interface {
	GetStatesForRuleUID(ctx context.Context, orgID int64, alertRuleUID string) []*state.State
}

// StatusReader provides per-rule health/timestamps, the only source of recording-rule
// status. Satisfied by schedule.ScheduleService (the in-memory scheduler).
type StatusReader interface {
	Status(ctx context.Context, key ngmodels.AlertRuleKey) (ngmodels.RuleStatus, bool)
}

// Syncer periodically computes rule-level status and persists it to alert_rule.k8s_status
// so the app-platform AlertRule/RecordingRule resources expose it.
type Syncer struct {
	store    RuleStore
	states   StateReader
	status   StatusReader // in-memory scheduler; the only source of recording-rule status
	interval time.Duration
	log      log.Logger

	// lastHash bounds write churn on the hot alert_rule table: a rule's status is only
	// written when it changed since the last sync.
	lastHash map[ngmodels.AlertRuleKey]uint64
}

func NewSyncer(store RuleStore, states StateReader, status StatusReader, interval time.Duration, logger log.Logger) *Syncer {
	return &Syncer{
		store:    store,
		states:   states,
		status:   status,
		interval: interval,
		log:      logger,
		lastHash: make(map[ngmodels.AlertRuleKey]uint64),
	}
}

// Run drives the periodic sync until ctx is cancelled.
func (s *Syncer) Run(ctx context.Context) error {
	s.log.Info("Starting rule status syncer", "interval", s.interval)
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := s.sync(ctx); err != nil {
				s.log.Error("Rule status sync failed", "error", err)
			}
		}
	}
}

func (s *Syncer) sync(ctx context.Context) error {
	orgIDs, err := s.store.FetchOrgIds(ctx)
	if err != nil {
		return fmt.Errorf("fetch org ids: %w", err)
	}
	for _, orgID := range orgIDs {
		rules, err := s.store.ListAlertRules(ctx, &ngmodels.ListAlertRulesQuery{OrgID: orgID})
		if err != nil {
			s.log.Error("Failed to list rules for status sync", "org_id", orgID, "error", err)
			continue
		}
		for _, rule := range rules {
			s.syncRule(ctx, rule)
		}
	}
	return nil
}

func (s *Syncer) syncRule(ctx context.Context, rule *ngmodels.AlertRule) {
	// Status is best-effort and must never crash the process: contain a panic on any
	// single rule, log it, and carry on with the rest.
	defer func() {
		if rec := recover(); rec != nil {
			s.log.Error("Panic while syncing rule status", "org_id", rule.OrgID, "uid", rule.UID, "panic", rec)
		}
	}()

	data, ok := s.computeStatus(ctx, rule)
	if !ok {
		return
	}
	key := rule.GetKey()
	h := hashBytes(data)
	if prev, seen := s.lastHash[key]; seen && prev == h {
		return // unchanged since last sync
	}
	if err := s.store.SaveAlertRuleStatus(ctx, rule.OrgID, rule.UID, data); err != nil {
		s.log.Error("Failed to persist rule status", "org_id", rule.OrgID, "uid", rule.UID, "error", err)
		return
	}
	s.lastHash[key] = h
}

// computeStatus builds and marshals the k8s status for a rule. Returns ok=false when
// the status could not be produced (e.g. a marshal failure).
func (s *Syncer) computeStatus(ctx context.Context, rule *ngmodels.AlertRule) ([]byte, bool) {
	var payload any
	switch rule.Type() {
	case ngmodels.RuleTypeRecording:
		// Recording rules produce no instance states — the scheduler is the only source
		// of their status.
		rs, found := s.status.Status(ctx, rule.GetKey())
		payload = toRecordingRuleStatus(rs, found, rule.IsPaused)
	default:
		states := s.states.GetStatesForRuleUID(ctx, rule.OrgID, rule.UID)
		payload = toAlertRuleStatus(states, rule.IsPaused)
	}

	data, err := json.Marshal(payload)
	if err != nil {
		s.log.Error("Failed to marshal rule status", "org_id", rule.OrgID, "uid", rule.UID, "error", err)
		return nil, false
	}
	return data, true
}

func hashBytes(b []byte) uint64 {
	h := fnv.New64a()
	_, _ = h.Write(b)
	return h.Sum64()
}
