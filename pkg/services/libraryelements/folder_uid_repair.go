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
	repairLockName    = "library element folder_uid repair"
	repairLockMaxWait = 10 * time.Minute

	repairKVNamespace = "libraryelements"
	// repairKVKey records per-org progress so restarts skip completed orgs.
	repairKVKey = "folder_uid_repaired"
	// repairKVKeyAllOrgs records that a full pass finished, which is what releases cleanup.
	repairKVKeyAllOrgs = "folder_uid_repaired_all_orgs"
	repairKVDone       = "true"
)

type repairOrgLister interface {
	Search(ctx context.Context, q *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
}

// FolderUIDRepairService is a registry.BackgroundService that runs once and returns.
type FolderUIDRepairService struct {
	store   db.DB
	folders folder.Service
	orgs    repairOrgLister
	lock    *serverlock.ServerLockService
	kv      kvstore.KVStore
	log     log.Logger
}

func ProvideFolderUIDRepair(
	store db.DB,
	folders folder.Service,
	orgs org.Service,
	lock *serverlock.ServerLockService,
	kv kvstore.KVStore,
) *FolderUIDRepairService {
	return newFolderUIDRepair(store, folders, orgs, lock, kv)
}

func newFolderUIDRepair(store db.DB, folders folder.Service, orgs repairOrgLister, lock *serverlock.ServerLockService, kv kvstore.KVStore) *FolderUIDRepairService {
	return &FolderUIDRepairService{
		store:   store,
		folders: folders,
		orgs:    orgs,
		lock:    lock,
		kv:      kv,
		log:     log.New("libraryelements.folderuidrepair"),
	}
}

func (s *FolderUIDRepairService) IsDisabled() bool {
	enabled, _ := openfeature.NewDefaultClient().BooleanValue(context.Background(),
		featuremgmt.FlagLibraryElementFolderUIDRepair, false, openfeature.EvaluationContext{})
	return !enabled
}

func (s *FolderUIDRepairService) Run(ctx context.Context) error {
	// Replicas start together, so only one should repair. Errors are logged rather than
	// returned: a failed repair must not stop Grafana from starting.
	if err := s.lock.LockExecuteAndRelease(ctx, repairLockName, repairLockMaxWait, func(ctx context.Context) {
		if err := s.repair(ctx); err != nil {
			s.log.Error("Failed to repair library element folder UIDs", "error", err)
		}
	}); err != nil {
		s.log.Debug("Skipping repair, lock held by another instance", "error", err)
	}
	return nil
}

func (s *FolderUIDRepairService) repair(ctx context.Context) error {
	orgs, err := s.orgs.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	complete := true
	for _, o := range orgs {
		done, err := s.isOrgRepaired(ctx, o.ID)
		if err != nil {
			return err
		}
		if done {
			continue
		}
		if err := s.repairOrg(ctx, o.ID); err != nil {
			// Mark nothing, so the next start retries this org.
			s.log.Error("Failed to repair org", "org_id", o.ID, "error", err)
			complete = false
			continue
		}
		if err := s.kv.Set(ctx, o.ID, repairKVNamespace, repairKVKey, repairKVDone); err != nil {
			return err
		}
	}
	if !complete {
		return nil
	}

	// One marker for every org, present and future: orgs created after a full pass run on
	// code that keeps folder_uid in sync, so they cannot carry the legacy drift.
	return s.kv.Set(ctx, kvstore.AllOrganizations, repairKVNamespace, repairKVKeyAllOrgs, repairKVDone)
}

func (s *FolderUIDRepairService) isOrgRepaired(ctx context.Context, orgID int64) (bool, error) {
	v, ok, err := s.kv.Get(ctx, orgID, repairKVNamespace, repairKVKey)
	if err != nil {
		return false, err
	}
	return ok && v == repairKVDone, nil
}

// cleanupAllowed reports whether a full repair pass has finished. It is deliberately not
// per-org: gating on a per-org marker would leave orgs created after the pass disabled
// forever, most obviously once the one-shot toggle is turned off again.
func (s *FolderUIDRepairService) cleanupAllowed(ctx context.Context) (bool, error) {
	v, ok, err := s.kv.Get(ctx, kvstore.AllOrganizations, repairKVNamespace, repairKVKeyAllOrgs)
	if err != nil {
		return false, err
	}
	return ok && v == repairKVDone, nil
}

func (s *FolderUIDRepairService) repairOrg(ctx context.Context, orgID int64) error {
	ctx, user := identity.WithServiceIdentity(ctx, orgID,
		identity.WithServiceIdentityName("library-element-folder-uid-repair"))

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
			// The folder is gone, so there is no UID to repair to. Deleting what it held is
			// the reconciler's decision, not this job's.
			continue
		case err != nil:
			// Unknown, not absent: stop rather than write a guess.
			return err
		}
		if err := s.repairFolder(ctx, orgID, folderID, f.UID); err != nil {
			return err
		}
	}

	return s.repairRoot(ctx, orgID)
}

// repairRoot normalizes every row at folder_id 0 to the empty string. folder_id is authoritative,
// and every read path already reports these panels as being in the general folder regardless of
// what folder_uid holds, so this makes the column agree with what users already see.
func (s *FolderUIDRepairService) repairRoot(ctx context.Context, orgID int64) error {
	return s.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec(`UPDATE library_element SET folder_uid='' `+
			`WHERE org_id=? AND folder_id=0 AND (folder_uid IS NULL OR folder_uid<>'')`, orgID)
		if err != nil {
			return err
		}
		s.logRepaired(res, orgID, 0, "")
		return nil
	})
}

func (s *FolderUIDRepairService) repairFolder(ctx context.Context, orgID, folderID int64, folderUID string) error {
	return s.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec(`UPDATE library_element SET folder_uid=? `+
			`WHERE org_id=? AND folder_id=? AND (folder_uid IS NULL OR folder_uid<>?)`,
			folderUID, orgID, folderID, folderUID)
		if err != nil {
			return err
		}
		s.logRepaired(res, orgID, folderID, folderUID)
		return nil
	})
}

func (s *FolderUIDRepairService) logRepaired(res sql.Result, orgID, folderID int64, folderUID string) {
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return
	}
	s.log.Info("Repaired library element folder UIDs",
		"org_id", orgID, "folder_id", folderID, "folder_uid", folderUID, "rows", rows)
}
