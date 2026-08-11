package libraryelements

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	healLockName    = "library element folder_uid heal"
	healLockMaxWait = 10 * time.Minute

	healKVNamespace = "libraryelements"
	healKVKey       = "folder_uid_healed"
	healKVDone      = "true"
)

type healOrgLister interface {
	Search(ctx context.Context, q *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
}

// FolderUIDHealService is a registry.BackgroundService that runs once and returns.
type FolderUIDHealService struct {
	store   db.DB
	folders folder.Service
	orgs    healOrgLister
	lock    *serverlock.ServerLockService
	kv      kvstore.KVStore
	log     log.Logger
}

func ProvideFolderUIDHeal(
	store db.DB,
	folders folder.Service,
	orgs org.Service,
	lock *serverlock.ServerLockService,
	kv kvstore.KVStore,
) *FolderUIDHealService {
	return newFolderUIDHeal(store, folders, orgs, lock, kv)
}

func newFolderUIDHeal(store db.DB, folders folder.Service, orgs healOrgLister, lock *serverlock.ServerLockService, kv kvstore.KVStore) *FolderUIDHealService {
	return &FolderUIDHealService{
		store:   store,
		folders: folders,
		orgs:    orgs,
		lock:    lock,
		kv:      kv,
		log:     log.New("libraryelements.folderuidheal"),
	}
}

func (s *FolderUIDHealService) IsDisabled() bool {
	enabled, _ := openfeature.NewDefaultClient().BooleanValue(context.Background(),
		featuremgmt.FlagLibraryElementFolderUIDHeal, false, openfeature.EvaluationContext{})
	return !enabled
}

func (s *FolderUIDHealService) Run(ctx context.Context) error {
	// Replicas start together, so only one should heal. Errors are logged rather than
	// returned: a failed repair must not stop Grafana from starting.
	if err := s.lock.LockExecuteAndRelease(ctx, healLockName, healLockMaxWait, func(ctx context.Context) {
		if err := s.heal(ctx); err != nil {
			s.log.Error("Failed to heal library element folder UIDs", "error", err)
		}
	}); err != nil {
		s.log.Debug("Skipping heal, lock held by another instance", "error", err)
	}
	return nil
}

func (s *FolderUIDHealService) heal(ctx context.Context) error {
	orgs, err := s.orgs.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	for _, o := range orgs {
		done, err := s.isHealed(ctx, o.ID)
		if err != nil {
			return err
		}
		if done {
			continue
		}
		if err := s.healOrg(ctx, o.ID); err != nil {
			// Mark nothing, so the next start retries this org.
			s.log.Error("Failed to heal org", "org_id", o.ID, "error", err)
			continue
		}
		if err := s.kv.Set(ctx, o.ID, healKVNamespace, healKVKey, healKVDone); err != nil {
			return err
		}
	}
	return nil
}

func (s *FolderUIDHealService) isHealed(ctx context.Context, orgID int64) (bool, error) {
	v, ok, err := s.kv.Get(ctx, orgID, healKVNamespace, healKVKey)
	if err != nil {
		return false, err
	}
	return ok && v == healKVDone, nil
}

func (s *FolderUIDHealService) healOrg(ctx context.Context, orgID int64) error {
	ctx, user := identity.WithServiceIdentity(ctx, orgID,
		identity.WithServiceIdentityName("library-element-folder-uid-heal"))

	// Rows at the root (folder_id 0) are left alone: there is no folder to resolve a UID from.
	var folderIDs []int64
	if err := s.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL("SELECT DISTINCT folder_id FROM library_element WHERE org_id=? AND folder_id<>0",
			orgID).Find(&folderIDs)
	}); err != nil {
		return err
	}

	for _, folderID := range folderIDs {
		f, err := s.folders.Get(ctx, &folder.GetFolderQuery{
			OrgID:        orgID,
			ID:           &folderID, // nolint:staticcheck
			SignedInUser: user,
		})
		switch {
		case errors.Is(err, dashboards.ErrFolderNotFound):
			// The folder is gone, so there is no UID to heal to. Deleting what it held is
			// the reconciler's decision, not this job's.
			continue
		case err != nil:
			// Unknown, not absent: stop rather than write a guess.
			return err
		}
		if err := s.healFolder(ctx, orgID, folderID, f.UID); err != nil {
			return err
		}
	}
	return nil
}

func (s *FolderUIDHealService) healFolder(ctx context.Context, orgID, folderID int64, folderUID string) error {
	return s.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec(`UPDATE library_element SET folder_uid=? `+
			`WHERE org_id=? AND folder_id=? AND (folder_uid IS NULL OR folder_uid<>?)`,
			folderUID, orgID, folderID, folderUID)
		if err != nil {
			return err
		}
		s.logHealed(res, orgID, folderID, folderUID)
		return nil
	})
}

func (s *FolderUIDHealService) logHealed(res sql.Result, orgID, folderID int64, folderUID string) {
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return
	}
	s.log.Info("Healed library element folder UIDs",
		"org_id", orgID, "folder_id", folderID, "folder_uid", folderUID, "rows", rows)
}
