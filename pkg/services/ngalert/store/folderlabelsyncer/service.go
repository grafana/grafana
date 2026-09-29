// Package folderlabelsyncer maintains a label on folders that contain Grafana-managed alert or recording
// rules, so callers can ask the folder API for "folders with rules" directly:
//
//	GET /apis/folder.grafana.app/v1/namespaces/{ns}/folders?labelSelector=alerting.grafana.app/has-rules=true
//
// It keeps the label in step two ways: a partial sync, driven by store.RuleChangeEvent on the
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
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

// HasRulesLabel marks a folder as holding at least one Grafana-managed alert or recording rule.
const HasRulesLabel = "alerting.grafana.app/has-rules"

// fullSyncJitterFactor randomizes each full sync interval by up to this fraction, so replicas that
// started together drift apart rather than all walking every folder at the same moment.
const fullSyncJitterFactor = 0.1

type syncerStore interface {
	CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error)
	GetAllFoldersWithRules(ctx context.Context, orgID int64) (result map[string]struct{}, err error)
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
	store            syncerStore
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

func NewService(cfg *setting.Cfg, b bus.Bus, store syncerStore, clients resource.ClientGenerator, m *metrics.FolderLabelSyncer) *Service {
	s := &Service{
		store:            store,
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

func (s *Service) handleRuleChange(_ context.Context, evt *store.RuleChangeEvent) error {
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

// partialSync brings a single folder's label in line with whether it currently holds rules. It is the
// event-driven counterpart to FullSync, reacting to one changed folder instead of walking all of them.
func (s *Service) partialSync(ctx context.Context, key models.FolderKey) error {
	namespace := s.namespacer(key.OrgID)
	ctx, user := serviceIdentity(ctx, key.OrgID)

	count, err := s.store.CountInFolders(ctx, key.OrgID, []string{key.UID}, user)
	if err != nil {
		return fmt.Errorf("count rules in folder: %w", err)
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

	if folder.Labels[HasRulesLabel] == "true" {
		if count > 0 {
			return nil
		}
	} else {
		if count == 0 {
			return nil
		}
	}

	if folder.Labels == nil {
		folder.Labels = map[string]string{}
	}
	if count > 0 {
		folder.Labels[HasRulesLabel] = "true"
	} else {
		delete(folder.Labels, HasRulesLabel)
	}

	if _, err := folders.Update(ctx, folder, resource.UpdateOptions{
		ResourceVersion: folder.ResourceVersion,
	}); err != nil {
		return fmt.Errorf("update folder label: %w", err)
	}

	s.log.Debug("Updated folder rules label",
		"org_id", key.OrgID, "folder_uid", key.UID, "rule_count", count)

	// Re-check the count we just acted on. Two replicas patching the same folder in opposite
	// directions can otherwise leave the label reflecting the older count; re-queueing on a change
	// lets the next pass settle it.
	if after, err := s.store.CountInFolders(ctx, key.OrgID, []string{key.UID}, user); err == nil && (after > 0) != (count > 0) {
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
