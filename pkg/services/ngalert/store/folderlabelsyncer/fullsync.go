package folderlabelsyncer

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// FullSync brings every existing folder's labels in line with the kinds of rule it holds, in both
// directions. It exists because the partial sync only reacts to changes, so folders that already
// held rules before this shipped carry no label.
//
// It runs once at startup and then on a timer, and is the only backstop for drift: a crash between
// the rule commit and the folder patch, a patch that failed and was not retried before the instance
// went idle, and ualert SQL migrations are all repaired by the next pass rather than while running.
//
// Rules moving to unified storage would bypass the rule store entirely, so neither the partial sync
// nor the query below would see those writes — that is the point at which an informer becomes
// available and becomes the right mechanism.
func (s *Service) FullSync(ctx context.Context) error {
	orgIDs, err := s.orgs.FetchOrgIds(ctx)
	if err != nil {
		// Counted as one whole-pass attempt: it failed before any org could be attempted, so there is
		// no per-org outcome to record.
		s.syncCompleted(metrics.SyncTypeFull, err)
		return fmt.Errorf("fetch orgs: %w", err)
	}

	total := 0
	for _, orgID := range orgIDs {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Skipped before fullSyncOrg rather than relying on markDirty: this avoids the folder-wide
		// walk entirely for an org alerting ignores, which is the expensive part of the pass.
		if _, ok := s.disabledOrgs[orgID]; ok {
			continue
		}

		n, err := s.fullSyncOrg(ctx, orgID)
		// Counted whether or not anything was queued: finding nothing to do is the healthy outcome on
		// an already-correct install, and is still evidence the pass ran.
		s.syncCompleted(metrics.SyncTypeFull, err)
		if err != nil {
			// One unhealthy org must not abort the pass for the rest.
			s.log.Error("Failed to full sync folder rules labels", "org_id", orgID, "error", err)
			continue
		}
		if n > 0 {
			s.log.Info("Queued folder rules label full sync", "org_id", orgID, "folder_count", n)
			total += n
		}
	}

	// Logged unconditionally: "0 folders" is the useful signal that an already-correct install did no
	// work, rather than that the pass never ran.
	s.log.Info("Folder label syncer full sync check finished", "folder_count", total, "org_count", len(orgIDs))
	return nil
}

// fullSyncOrg queues the folders whose labels disagree with the database, and returns how many.
func (s *Service) fullSyncOrg(ctx context.Context, orgID int64) (int, error) {
	// Attach the per-org identity before any database- or namespace-scoped call below: a
	// context-dependent LegacyDatabaseProvider needs it to resolve the right org's database.
	ctx, _ = serviceIdentity(ctx, orgID)

	withAlerts, err := s.store.GetAllFoldersWithRulesByType(ctx, orgID, models.RuleTypeFilterAlerting)
	if err != nil {
		return 0, fmt.Errorf("list folders with alert rules: %w", err)
	}
	withRecordings, err := s.store.GetAllFoldersWithRulesByType(ctx, orgID, models.RuleTypeFilterRecording)
	if err != nil {
		return 0, fmt.Errorf("list folders with recording rules: %w", err)
	}

	labeled, err := s.labeledFolders(ctx, orgID)
	if err != nil {
		return 0, fmt.Errorf("list labeled folders: %w", err)
	}

	stale := diffFolderKeys(orgID, withAlerts, withRecordings, labeled)
	if len(stale) == 0 {
		return 0, nil
	}

	s.markDirty(stale)
	return len(stale), nil
}

// labelState is which of the syncer's labels a folder carries. legacy is the retired single label,
// which is stale on any folder that still has it regardless of the rules it holds.
type labelState struct {
	alert, recording, legacy bool
}

// diffFolderKeys returns the folders whose labels differ from what their rules call for: the union of
// folders holding rules and folders carrying any label, since either side can be the stale one.
func diffFolderKeys(orgID int64, withAlerts, withRecordings map[string]struct{}, labeled map[string]labelState) []models.FolderKey {
	uids := make(map[string]struct{}, len(withAlerts)+len(withRecordings)+len(labeled))
	for uid := range withAlerts {
		uids[uid] = struct{}{}
	}
	for uid := range withRecordings {
		uids[uid] = struct{}{}
	}
	for uid := range labeled {
		uids[uid] = struct{}{}
	}

	var stale []models.FolderKey
	for uid := range uids {
		_, wantAlert := withAlerts[uid]
		_, wantRecording := withRecordings[uid]
		have := labeled[uid]
		if have.legacy || have.alert != wantAlert || have.recording != wantRecording {
			stale = append(stale, models.FolderKey{OrgID: orgID, UID: uid})
		}
	}
	return stale
}

// labeledFolders lists the folders carrying each of the syncer's labels. Label filters on a list are
// ANDed, so each label needs its own list.
func (s *Service) labeledFolders(ctx context.Context, orgID int64) (map[string]labelState, error) {
	folders, err := s.folderClient()
	if err != nil {
		return nil, err
	}

	out := make(map[string]labelState)
	for _, l := range []struct {
		label string
		set   func(*labelState)
	}{
		{HasAlertRulesLabel, func(st *labelState) { st.alert = true }},
		{HasRecordingRulesLabel, func(st *labelState) { st.recording = true }},
		{legacyHasRulesLabel, func(st *labelState) { st.legacy = true }},
	} {
		// The syncer only ever wrote "true", so that is the only value to look for.
		list, err := folders.ListAll(ctx, s.namespacer(orgID), resource.ListOptions{
			LabelFilters: []string{l.label + "=true"},
		})
		if err != nil {
			return nil, err
		}
		for i := range list.Items {
			st := out[list.Items[i].Name]
			l.set(&st)
			out[list.Items[i].Name] = st
		}
	}
	return out, nil
}
