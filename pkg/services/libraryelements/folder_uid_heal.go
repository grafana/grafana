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
	// healKVKey records per-org progress so restarts skip completed orgs.
	healKVKey = "folder_uid_healed"
	// healKVKeyAllOrgs records that a full pass finished, which is what releases cleanup.
	healKVKeyAllOrgs = "folder_uid_healed_all_orgs"
	healKVDone       = "true"
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

	complete := true
	for _, o := range orgs {
		done, err := s.isOrgHealed(ctx, o.ID)
		if err != nil {
			return err
		}
		if done {
			continue
		}
		if err := s.healOrg(ctx, o.ID); err != nil {
			// Mark nothing, so the next start retries this org.
			s.log.Error("Failed to heal org", "org_id", o.ID, "error", err)
			complete = false
			continue
		}
		if err := s.kv.Set(ctx, o.ID, healKVNamespace, healKVKey, healKVDone); err != nil {
			return err
		}
	}
	if !complete {
		return nil
	}

	// One marker for every org, present and future: orgs created after a full pass run on
	// code that keeps folder_uid in sync, so they cannot carry the legacy drift.
	return s.kv.Set(ctx, kvstore.AllOrganizations, healKVNamespace, healKVKeyAllOrgs, healKVDone)
}

func (s *FolderUIDHealService) isOrgHealed(ctx context.Context, orgID int64) (bool, error) {
	v, ok, err := s.kv.Get(ctx, orgID, healKVNamespace, healKVKey)
	if err != nil {
		return false, err
	}
	return ok && v == healKVDone, nil
}

// cleanupAllowed reports whether a full heal pass has finished. It is deliberately not
// per-org: gating on a per-org marker would leave orgs created after the pass disabled
// forever, most obviously once the one-shot toggle is turned off again.
func (s *FolderUIDHealService) cleanupAllowed(ctx context.Context) (bool, error) {
	v, ok, err := s.kv.Get(ctx, kvstore.AllOrganizations, healKVNamespace, healKVKeyAllOrgs)
	if err != nil {
		return false, err
	}
	return ok && v == healKVDone, nil
}

func (s *FolderUIDHealService) healOrg(ctx context.Context, orgID int64) error {
	ctx, user := identity.WithServiceIdentity(ctx, orgID,
		identity.WithServiceIdentityName("library-element-folder-uid-heal"))

	if err := s.healRoot(ctx, orgID); err != nil {
		return err
	}

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

// healRoot normalizes the markers that mean "no folder" (NULL and 'general') to the empty
// string every write path converges on. A root row holding a real UID is left alone: the k8s
// create path wrote those before it aligned folder_id, so the panel does live in that folder.
func (s *FolderUIDHealService) healRoot(ctx context.Context, orgID int64) error {
	return s.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec(`UPDATE library_element SET folder_uid='' `+
			`WHERE org_id=? AND folder_id=0 AND (folder_uid IS NULL OR folder_uid=?)`,
			orgID, folder.GeneralFolderUID)
		if err != nil {
			return err
		}
		s.logHealed(res, orgID, 0, "")
		return nil
	})
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
