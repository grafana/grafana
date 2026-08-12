// Package folderlabel maintains a label on folders that contain Grafana-managed alert or recording
// rules, so callers can ask the folder API for "folders with rules" directly:
//
//	GET /apis/folder.grafana.app/v1/namespaces/{ns}/folders?labelSelector=alerting.grafana.app/has-rules=true
//
// It is driven by store.RuleChangeEvent on the in-process bus rather than by an informer on the rule
// kinds. An informer is not an option today: alert rules are served by legacy storage or the dual
// writer, neither of which implements rest.Watcher, so the apiserver never registers the watch verb
// for them. The legacy rule store is the one point every runtime write path converges on, which is
// why the bus event is the broadest signal available.
package folderlabel

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// LabelKey marks a folder as holding at least one Grafana-managed alert or recording rule.
	HasRulesLabel = "alerting.grafana.app/has-rules"

	// The slash in the label key is escaped as "~1" to avoid the apiserver reading it as two path segments
	hasRulesLabelPath = "/metadata/labels/alerting.grafana.app~1has-rules"
)

type ruleCounter interface {
	CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error)
}

type folderPatcher interface {
	Get(ctx context.Context, id resource.Identifier) (*folderv1.Folder, error)
	Patch(ctx context.Context, id resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*folderv1.Folder, error)
	ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*folderv1.FolderList, error)
}

func serviceIdentity(ctx context.Context, orgID int64) (context.Context, identity.Requester) {
	return identity.WithServiceIdentity(ctx, orgID,
		identity.WithServiceIdentityName("alerting-folder-label"))
}

type Service struct {
	rules      ruleCounter
	clients    resource.ClientGenerator
	namespacer request.NamespaceMapper
	log        log.Logger

	mu    sync.Mutex
	dirty map[models.FolderKey]struct{}
	wake  chan struct{}

	clientMu sync.Mutex
	folders  folderPatcher
}

func NewService(cfg *setting.Cfg, b bus.Bus, rules ruleCounter, clients resource.ClientGenerator) *Service {
	s := &Service{
		rules:      rules,
		clients:    clients,
		namespacer: request.GetNamespaceMapper(cfg),
		log:        log.New("ngalert.folderlabel"),
		dirty:      make(map[models.FolderKey]struct{}),
		wake:       make(chan struct{}, 1),
	}
	b.AddEventListener(s.handleRuleChange)
	return s
}

// marks folder keys as needing reconciliation and wakes the worker to process them
func (s *Service) markDirty(keys []models.FolderKey) {
	s.mu.Lock()
	for _, k := range keys {
		if k.UID == "" || k.OrgID < 1 {
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

func (s *Service) Run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-s.wake:
			s.drain(ctx)
		}
	}
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
		if err := s.reconcile(ctx, key); err != nil {
			s.log.Warn("Failed to reconcile folder rules label",
				"org_id", key.OrgID, "folder_uid", key.UID, "error", err)
			s.mu.Lock()
			// re-queue failures so the next wake cycle retries them
			s.dirty[key] = struct{}{}
			s.mu.Unlock()
		}
		processed++
	}

	s.log.Info("Reconciled rules labels on folders", "count", processed)
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

func (s *Service) reconcile(ctx context.Context, key models.FolderKey) error {
	namespace := s.namespacer(key.OrgID)
	ctx, user := serviceIdentity(ctx, key.OrgID)

	count, err := s.rules.CountInFolders(ctx, key.OrgID, []string{key.UID}, user)
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
			// The folder is already gone; nothing left to mark.
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

	patchOperation := generatePatch(count, folder)

	_, err = folders.Patch(ctx, id, resource.PatchRequest{
		Operations: []resource.PatchOperation{patchOperation},
	}, resource.PatchOptions{})
	if err != nil {
		return fmt.Errorf("patch folder label: %w", err)
	}

	s.log.Debug("Updated folder rules label",
		"org_id", key.OrgID, "folder_uid", key.UID, "rule_count", count)

	// Re-check the count we just acted on. Two replicas patching the same folder in opposite
	// directions can otherwise leave the label reflecting the older count; re-queueing on a change
	// lets the next pass settle it.
	if after, err := s.rules.CountInFolders(ctx, key.OrgID, []string{key.UID}, user); err == nil && (after > 0) != (count > 0) {
		s.markDirty([]models.FolderKey{key})
	}

	return nil
}

func generatePatch(count int64, folder *folderv1.Folder) resource.PatchOperation {
	if count > 0 {
		if folder.Labels == nil {
			return resource.PatchOperation{
				Operation: resource.PatchOpAdd,
				Path:      "/metadata/labels",
				Value:     map[string]string{HasRulesLabel: "true"},
			}
		}

		return resource.PatchOperation{
			Operation: resource.PatchOpAdd,
			Path:      hasRulesLabelPath,
			Value:     "true",
		}
	}

	return resource.PatchOperation{
		Operation: resource.PatchOpRemove,
		Path:      hasRulesLabelPath,
	}
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
