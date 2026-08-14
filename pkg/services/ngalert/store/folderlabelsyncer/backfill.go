package folderlabelsyncer

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Backfill brings every existing folder's label in line with whether it holds rules, in both
// directions. It exists because the event path only reacts to changes, so folders that already held
// rules before this shipped carry no label.
//
// It runs once at startup, and is the only backstop for drift: a crash between the rule commit and
// the folder patch, a patch that failed and was not retried before the instance went idle, and
// ualert SQL migrations are all repaired by the next start rather than while running.
//
// Rules moving to unified storage would bypass the rule store entirely, so neither the events nor
// the query below would see those writes — that is the point at which an informer becomes available
// and becomes the right mechanism.
func (s *Service) Backfill(ctx context.Context, disabledOrgs map[int64]struct{}) error {
	orgIDs, err := s.store.FetchOrgIds(ctx)
	if err != nil {
		return fmt.Errorf("fetch orgs: %w", err)
	}

	total := 0
	for _, orgID := range orgIDs {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		if _, ok := disabledOrgs[orgID]; ok {
			continue
		}

		n, err := s.backfillOrg(ctx, orgID)
		if err != nil {
			// One unhealthy org must not abort the pass for the rest.
			s.log.Error("Failed to backfill folder rules labels", "org_id", orgID, "error", err)
			continue
		}
		if n > 0 {
			s.log.Info("Queued folder rules label backfill", "org_id", orgID, "folder_count", n)
			total += n
		}
	}

	// Logged unconditionally: "0 folders" is the useful signal that an already-correct install did no
	// work, rather than that the pass never ran.
	s.log.Info("Folder rules label backfill queued", "folder_count", total, "org_count", len(orgIDs))
	return nil
}

// backfillOrg queues the folders whose label disagrees with the database, and returns how many.
func (s *Service) backfillOrg(ctx context.Context, orgID int64) (int, error) {
	withRules, err := s.store.GetAllFoldersWithRules(ctx, orgID)
	if err != nil {
		return 0, fmt.Errorf("list folders with rules: %w", err)
	}

	labeled, err := s.labeledFolders(ctx, orgID)
	if err != nil {
		return 0, fmt.Errorf("list labeled folders: %w", err)
	}

	stale := diffFolderKeys(orgID, withRules, labeled)
	if len(stale) == 0 {
		return 0, nil
	}

	s.markDirty(stale)
	return len(stale), nil
}

func diffFolderKeys(orgID int64, withRules, labeled map[string]struct{}) []models.FolderKey {
	var stale []models.FolderKey
	for uid := range withRules {
		if _, ok := labeled[uid]; !ok {
			stale = append(stale, models.FolderKey{OrgID: orgID, UID: uid})
		}
	}
	for uid := range labeled {
		if _, ok := withRules[uid]; !ok {
			stale = append(stale, models.FolderKey{OrgID: orgID, UID: uid})
		}
	}
	return stale
}

func (s *Service) labeledFolders(ctx context.Context, orgID int64) (map[string]struct{}, error) {
	folders, err := s.folderClient()
	if err != nil {
		return nil, err
	}

	ctx, _ = serviceIdentity(ctx, orgID)

	list, err := folders.ListAll(ctx, s.namespacer(orgID), resource.ListOptions{
		LabelFilters: []string{HasRulesLabel + "=true"},
	})
	if err != nil {
		return nil, err
	}

	set := make(map[string]struct{}, len(list.Items))
	for i := range list.Items {
		set[list.Items[i].Name] = struct{}{}
	}
	return set, nil
}
