// Package folderlabelsyncer maintains labels on folders that contain Grafana-managed alert or recording
// rules, so callers can ask the folder API for folders holding a given kind of rule directly:
//
//	GET /apis/folder.grafana.app/v1/namespaces/{ns}/folders?labelSelector=alerting.grafana.app/has-alert-rules=true
//	GET /apis/folder.grafana.app/v1/namespaces/{ns}/folders?labelSelector=alerting.grafana.app/has-recording-rules=true
//
// It keeps the label in step two ways: a partial sync, driven by rules.RuleChangeEvent on the
// in-process bus, reacts to a single folder's rules changing; a full sync walks every folder in an
// org and corrects any that drifted, run once at startup and then on a timer as a backstop.
//
// The bus event is the broadest signal available for the partial sync rather than an informer on the
// rule kinds, because an informer is not an option today: alert rules are served by legacy storage or
// the dual writer, neither of which implements rest.Watcher, so the apiserver never registers the
// watch verb for them. The legacy rule store is the one point every runtime write path converges on.
package folderlabelsyncer

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/setting"
)

// HasAlertRulesLabel marks a folder as holding at least one Grafana-managed alert rule.
const HasAlertRulesLabel = "alerting.grafana.app/has-alert-rules"

// HasRecordingRulesLabel marks a folder as holding at least one Grafana-managed recording rule.
const HasRecordingRulesLabel = "alerting.grafana.app/has-recording-rules"

// legacyHasRulesLabel was a single label for a folder holding rules of either kind. It is no longer
// written, and is removed from any folder that still carries it.
const legacyHasRulesLabel = "alerting.grafana.app/has-rules"

// fullSyncJitterFactor randomizes each full sync interval by up to this fraction, so replicas that
// started together drift apart rather than all walking every folder at the same moment.
const fullSyncJitterFactor = 0.1

// syncerOrgStore lists orgs to walk during a full sync. Separate from the rule-side dependency
// because orgs are still owned by *store.DBstore.
type syncerOrgStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
}

type folderPatcher interface {
	Get(ctx context.Context, id resource.Identifier) (*folderv1.Folder, error)
	Update(ctx context.Context, obj *folderv1.Folder, opts resource.UpdateOptions) (*folderv1.Folder, error)
	ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*folderv1.FolderList, error)
}

func serviceIdentity(ctx context.Context, orgID int64) (context.Context, identity.Requester) {
	return identity.WithServiceIdentity(ctx, orgID,
		identity.WithServiceIdentityName("alerting-folder-label"))
}

type Service struct {
	store            rules.FolderRuleCounter
	orgs             syncerOrgStore
	clients          resource.ClientGenerator
	namespacer       request.NamespaceMapper
	log              log.Logger
	metrics          *metrics.FolderLabelSyncer
	fullSyncInterval time.Duration
	retryBackoff     wait.Backoff
	// disabledOrgs are the orgs alerting ignores. Held on the Service rather than passed to Run so
	// both the full sync and the event-driven partial sync see it: rule writes are not rejected for a
	// disabled org, so without this a rule change there would still relabel its folder.
	disabledOrgs map[int64]struct{}

	mu    sync.Mutex
	dirty map[models.FolderKey]struct{}
	wake  chan struct{}

	clientMu sync.Mutex
	folders  folderPatcher
}

func NewService(cfg *setting.Cfg, b bus.Bus, store rules.FolderRuleCounter, orgs syncerOrgStore, clients resource.ClientGenerator, m *metrics.FolderLabelSyncer) *Service {
	s := &Service{
		store:            store,
		orgs:             orgs,
		clients:          clients,
		namespacer:       request.GetNamespaceMapper(cfg),
		log:              log.New("ngalert.folderlabelsyncer"),
		metrics:          m,
		fullSyncInterval: cfg.UnifiedAlerting.FolderLabelFullSyncInterval,
		retryBackoff:     retry.DefaultBackoff,
		disabledOrgs:     cfg.UnifiedAlerting.DisabledOrgs,
		dirty:            make(map[models.FolderKey]struct{}),
		wake:             make(chan struct{}, 1),
	}
	b.AddEventListener(s.handleRuleChange)
	return s
}

// markDirty queues folder keys for a partial sync and wakes the worker. Disabled orgs are filtered
// here because this is the one point both callers converge on, so neither a rule change nor the full
// sync can queue work for an org alerting is meant to ignore.
func (s *Service) markDirty(keys []models.FolderKey) {
	s.mu.Lock()
	for _, k := range keys {
		if k.UID == "" || k.OrgID < 1 {
			continue
		}
		if _, disabled := s.disabledOrgs[k.OrgID]; disabled {
			continue
		}
		s.dirty[k] = struct{}{}
	}
	s.mu.Unlock()
	s.signal()
}

func (s *Service) handleRuleChange(_ context.Context, evt *rules.RuleChangeEvent) error {
	if len(evt.FolderKeys) == 0 {
		return nil
	}
	s.markDirty(evt.FolderKeys)
	return nil
}

func (s *Service) signal() {
	select {
	case s.wake <- struct{}{}:
	default: // a wake-up is already queued
	}
}

// Run performs a full sync once at startup, then processes partial syncs as rule changes wake it and
// repeats the full sync every fullSyncInterval in the background.
func (s *Service) Run(ctx context.Context) error {
	if err := s.FullSync(ctx); err != nil {
		s.log.Warn("Failed to run startup folder rules label full sync", "error", err)
	}

	// Jitter each interval independently so replicas that started together do not full sync in
	// lockstep: the full sync walks every folder in every org, and there is no leader election, so
	// each replica does that work. A fresh timer per pass rather than a fixed ticker lets the delay
	// vary every time, so replicas drift apart instead of staying aligned.
	fullSync := time.NewTimer(wait.Jitter(s.fullSyncInterval, fullSyncJitterFactor))
	defer fullSync.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-s.wake:
			s.drain(ctx)
		case <-fullSync.C:
			// Re-armed before the sync runs so a slow walk is not added to the interval, keeping the
			// cadence start-to-start as the ticker did. Reset is safe here: the timer has fired and its
			// channel has been drained.
			fullSync.Reset(wait.Jitter(s.fullSyncInterval, fullSyncJitterFactor))
			if err := s.FullSync(ctx); err != nil {
				s.log.Warn("Failed to run periodic folder rules label full sync", "error", err)
			}
		}
	}
}

func isRetriable(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	return apierrors.IsConflict(err) ||
		apierrors.IsTooManyRequests(err) ||
		apierrors.IsServerTimeout(err) ||
		apierrors.IsTimeout(err) ||
		apierrors.IsInternalError(err) ||
		apierrors.IsServiceUnavailable(err)
}

func (s *Service) drain(ctx context.Context) {
	processed := 0
	keys := s.take()
	if len(keys) == 0 {
		return
	}
	for _, key := range keys {
		if ctx.Err() != nil {
			return
		}
		attempts := 0
		err := retry.OnError(s.retryBackoff, isRetriable, func() error {
			attempts++
			if err := s.partialSync(ctx, key); err != nil {
				s.log.Debug("Attempt to sync folder rules label failed",
					"org_id", key.OrgID, "folder_uid", key.UID, "attempt", attempts, "error", err)
				return err
			}
			return nil
		})
		// Recorded once per folder rather than per attempt, so a retried folder does not inflate
		// either counter.
		s.syncCompleted(metrics.SyncTypePartial, err)
		if err != nil {
			s.log.Warn("Failed to sync folder rules label",
				"org_id", key.OrgID, "folder_uid", key.UID, "attempts", attempts, "error", err)
		} else {
			processed++
		}
	}

	s.log.Info("Synced rules labels on folders", "count", processed)
}

func (s *Service) take() []models.FolderKey {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.dirty) == 0 {
		return nil
	}
	keys := make([]models.FolderKey, 0, len(s.dirty))
	for k := range s.dirty {
		keys = append(keys, k)
	}
	s.dirty = make(map[models.FolderKey]struct{})
	return keys
}

// syncCompleted records one finished sync against its sync_type, and additionally a failure when err
// is non-nil. Total counts every attempt rather than only successes, so Failures is a strict subset
// of it and Failures/Total is a meaningful error rate. Recording both from one place keeps that
// invariant out of reach of the call sites. Tolerates nil metrics so a Service can be built without
// them.
func (s *Service) syncCompleted(syncType string, err error) {
	if s.metrics == nil {
		return
	}
	s.metrics.Total.WithLabelValues(syncType).Inc()
	if err != nil {
		s.metrics.Failures.WithLabelValues(syncType).Inc()
	}
}

// folderRuleState is which kinds of rule a folder holds.
type folderRuleState struct {
	alert, recording bool
}

// countRules reports which kinds of rule currently live in the folder.
func (s *Service) countRules(ctx context.Context, key models.FolderKey, user identity.Requester) (folderRuleState, error) {
	alerts, err := s.store.CountInFoldersByType(ctx, key.OrgID, []string{key.UID}, models.RuleTypeFilterAlerting, user)
	if err != nil {
		return folderRuleState{}, fmt.Errorf("count alert rules in folder: %w", err)
	}
	recordings, err := s.store.CountInFoldersByType(ctx, key.OrgID, []string{key.UID}, models.RuleTypeFilterRecording, user)
	if err != nil {
		return folderRuleState{}, fmt.Errorf("count recording rules in folder: %w", err)
	}
	return folderRuleState{alert: alerts > 0, recording: recordings > 0}, nil
}

// applyLabels brings the folder's labels in line with want, removing the legacy label, and reports
// whether anything changed.
func applyLabels(folder *folderv1.Folder, want folderRuleState) bool {
	changed := false
	if _, ok := folder.Labels[legacyHasRulesLabel]; ok {
		delete(folder.Labels, legacyHasRulesLabel)
		changed = true
	}
	for label, wanted := range map[string]bool{
		HasAlertRulesLabel:     want.alert,
		HasRecordingRulesLabel: want.recording,
	} {
		current, present := folder.Labels[label]
		switch {
		case wanted && current != "true":
			if folder.Labels == nil {
				folder.Labels = map[string]string{}
			}
			folder.Labels[label] = "true"
			changed = true
		case !wanted && present:
			delete(folder.Labels, label)
			changed = true
		}
	}
	return changed
}

// partialSync brings a single folder's labels in line with which kinds of rule it currently holds. It
// is the event-driven counterpart to FullSync, reacting to one changed folder instead of walking all of
// them.
func (s *Service) partialSync(ctx context.Context, key models.FolderKey) error {
	namespace := s.namespacer(key.OrgID)
	ctx, user := serviceIdentity(ctx, key.OrgID)

	state, err := s.countRules(ctx, key, user)
	if err != nil {
		return err
	}

	folders, err := s.folderClient()
	if err != nil {
		return err
	}

	id := resource.Identifier{Namespace: namespace, Name: key.UID}
	folder, err := folders.Get(ctx, id)
	if err != nil {
		if apierrors.IsNotFound(err) {
			// The folder is already gone; nothing left to mark. Not counted as a failure: this is the
			// expected outcome when a folder is deleted between the event and the sync.
			return nil
		}
		return fmt.Errorf("get folder: %w", err)
	}

	if !applyLabels(folder, state) {
		return nil
	}

	if _, err := folders.Update(ctx, folder, resource.UpdateOptions{
		ResourceVersion: folder.ResourceVersion,
	}); err != nil {
		return fmt.Errorf("update folder label: %w", err)
	}

	s.log.Debug("Updated folder rules labels",
		"org_id", key.OrgID, "folder_uid", key.UID, "has_alert_rules", state.alert, "has_recording_rules", state.recording)

	// Re-check the state we just acted on. Two replicas patching the same folder in opposite
	// directions can otherwise leave the labels reflecting the older state; re-queueing on a change
	// lets the next pass settle it.
	if after, err := s.countRules(ctx, key, user); err == nil && after != state {
		s.markDirty([]models.FolderKey{key})
	}

	return nil
}

func (s *Service) folderClient() (folderPatcher, error) {
	s.clientMu.Lock()
	defer s.clientMu.Unlock()
	if s.folders != nil {
		return s.folders, nil
	}
	// Not cached on failure, so a client that was unavailable at first use can be built later.
	c, err := folderv1.NewFolderClientFromGenerator(s.clients)
	if err != nil {
		return nil, fmt.Errorf("build folder client: %w", err)
	}
	s.folders = c
	return s.folders, nil
}
