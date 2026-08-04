// Package status persists rule-level status (state/health/reason) onto the
// app-platform AlertRule/RecordingRule resources. Writes go through the k8s
// client's /status subresource (not directly to the store) so the same write
// path also mirrors the status to unified storage and keeps resourceVersion
// semantics correct at every storage mode.
package status

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

// serviceIdentityName labels the background identity used for the loopback
// status writes, so they are attributable in audit/authz.
const serviceIdentityName = "ngalert-status-syncer"

// OrgStore enumerates the orgs whose rules should be synced. Satisfied by *store.DBstore.
type OrgStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
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

// Syncer periodically computes rule-level status and writes it to the AlertRule/
// RecordingRule /status subresource so the app-platform resources expose it.
type Syncer struct {
	orgs       OrgStore
	states     StateReader
	status     StatusReader // in-memory scheduler; the only source of recording-rule status
	namespacer request.NamespaceMapper
	interval   time.Duration
	log        log.Logger

	// lastHash bounds write churn: a rule's status is only written when it changed
	// since the last sync, so a steady state does not re-issue loopback writes.
	lastHash map[ngmodels.AlertRuleKey]uint64

	alertRuleClient     *v0alpha1.AlertRuleClient
	recordingRuleClient *v0alpha1.RecordingRuleClient
}

func NewSyncer(orgs OrgStore, states StateReader, status StatusReader, namespacer request.NamespaceMapper, interval time.Duration, logger log.Logger, clientGenerator resource.ClientGenerator) (*Syncer, error) {
	alertRuleClient, err := v0alpha1.NewAlertRuleClientFromGenerator(clientGenerator)
	if err != nil {
		return nil, fmt.Errorf("alert rule client: %w", err)
	}
	recordingRuleClient, err := v0alpha1.NewRecordingRuleClientFromGenerator(clientGenerator)
	if err != nil {
		return nil, fmt.Errorf("recording rule client: %w", err)
	}

	return &Syncer{
		orgs:                orgs,
		states:              states,
		status:              status,
		namespacer:          namespacer,
		interval:            interval,
		log:                 logger,
		lastHash:            make(map[ngmodels.AlertRuleKey]uint64),
		alertRuleClient:     alertRuleClient,
		recordingRuleClient: recordingRuleClient,
	}, nil
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
	orgIDs, err := s.orgs.FetchOrgIds(ctx)
	if err != nil {
		return fmt.Errorf("fetch org ids: %w", err)
	}
	for _, orgID := range orgIDs {
		s.syncOrg(ctx, orgID)
	}
	return nil
}

func (s *Syncer) syncOrg(ctx context.Context, orgID int64) {
	start := time.Now()
	var alertRuleCount, recordingRuleCount int
	defer func() {
		s.log.Debug("Synced rule status for org",
			"org_id", orgID,
			"alert_rules", alertRuleCount,
			"recording_rules", recordingRuleCount,
			"duration", time.Since(start))
	}()

	namespace := s.namespacer(orgID)
	ctx = identity.WithServiceIdentityContext(ctx, orgID, identity.WithServiceIdentityName(serviceIdentityName))

	alertRules, err := s.alertRuleClient.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		s.log.Error("Failed to list alert rules for status sync", "org_id", orgID, "error", err)
	} else {
		alertRuleCount = len(alertRules.Items)
		for i := range alertRules.Items {
			s.syncAlertRule(ctx, orgID, &alertRules.Items[i])
		}
	}

	recordingRules, err := s.recordingRuleClient.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		s.log.Error("Failed to list recording rules for status sync", "org_id", orgID, "error", err)
		return
	}
	recordingRuleCount = len(recordingRules.Items)
	for i := range recordingRules.Items {
		s.syncRecordingRule(ctx, orgID, &recordingRules.Items[i])
	}
}

func (s *Syncer) syncAlertRule(ctx context.Context, orgID int64, rule *v0alpha1.AlertRule) {
	defer s.recoverRule(orgID, rule.Name)

	key := ngmodels.AlertRuleKey{OrgID: orgID, UID: rule.Name}
	states := s.states.GetStatesForRuleUID(ctx, orgID, rule.Name)
	newStatus := toAlertRuleStatus(states, isPaused(rule.Spec.Paused))
	rule.Status = newStatus

	s.persist(ctx, key, newStatus, func(ctx context.Context) error {
		_, err := s.alertRuleClient.Update(ctx, rule, resource.UpdateOptions{
			Subresource: "status",
		})
		return err
	})
}

func (s *Syncer) syncRecordingRule(ctx context.Context, orgID int64, rule *v0alpha1.RecordingRule) {
	defer s.recoverRule(orgID, rule.Name)

	key := ngmodels.AlertRuleKey{OrgID: orgID, UID: rule.Name}
	// Recording rules produce no instance states — the scheduler is the only source.
	rs, found := s.status.Status(ctx, key)
	newStatus := toRecordingRuleStatus(rs, found, isPaused(rule.Spec.Paused))
	rule.Status = newStatus

	s.persist(ctx, key, newStatus, func(ctx context.Context) error {
		_, err := s.recordingRuleClient.Update(ctx, rule, resource.UpdateOptions{
			Subresource: "status",
		})
		return err
	})
}

// persist writes the status via write only when it changed since the last sync,
// recording the new hash on success so unchanged statuses are not re-written.
func (s *Syncer) persist(ctx context.Context, key ngmodels.AlertRuleKey, status any, write func(context.Context) error) {
	data, err := json.Marshal(status)
	if err != nil {
		s.log.Error("Failed to marshal rule status", "org_id", key.OrgID, "uid", key.UID, "error", err)
		return
	}
	h := hashBytes(data)
	if prev, seen := s.lastHash[key]; seen && prev == h {
		return
	}
	if err := write(ctx); err != nil {
		s.log.Error("Failed to persist rule status", "org_id", key.OrgID, "uid", key.UID, "error", err)
		return
	}
	s.lastHash[key] = h
}

// recoverRule contains a panic while syncing a single rule so status sync never
// crashes the process; the rest of the rules still sync.
func (s *Syncer) recoverRule(orgID int64, uid string) {
	if rec := recover(); rec != nil {
		s.log.Error("Panic while syncing rule status", "org_id", orgID, "uid", uid, "panic", rec)
	}
}

func isPaused(p *bool) bool { return p != nil && *p }

func hashBytes(b []byte) uint64 {
	h := fnv.New64a()
	_, _ = h.Write(b)
	return h.Sum64()
}
