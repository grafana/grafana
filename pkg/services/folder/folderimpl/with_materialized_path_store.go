package folderimpl

import (
	"context"
	"runtime"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
)

type materializedPathStore struct {
	sqlStore
	log log.Logger
}

func ProvideMaterializedPathStore(db db.DB) (*materializedPathStore, error) {
	logger := log.New("folder-materialized-path-store")
	store := &materializedPathStore{
		log:      logger,
		sqlStore: sqlStore{db: db, log: logger},
	}

	if err := store.migrate(); err != nil {
		return nil, folder.ErrInternal.Errorf("failed to migrate tree: %w", err)
	}

	return store, nil
}

func (mps *materializedPathStore) migrate() error {
	ctx := context.Background()
	return mps.db.InTransaction(ctx, func(ctx context.Context) error {
		if err := mps.db.WithDbSession(ctx, func(sess *db.Session) error {
			var folders []*folder.Folder
			if err := sess.SQL("SELECT org_id, uid FROM folder WHERE fullpath IS NULL").Find(&folders); err != nil {
				return err
			}

			if err := concurrency.ForEachJob(ctx, len(folders), runtime.NumCPU(), func(ctx context.Context, idx int) error {
				fullpath, err := mps.getFullpath(ctx, folders[idx].OrgID, folders[idx].UID)
				if err != nil {
					mps.log.Error("failed to get fullpath", "err", err, "org_id", folders[idx].OrgID, "uid", folders[idx].UID)
					return err
				}

				if _, err := sess.Exec("UPDATE folder SET fullpath = ? WHERE org_id = ? AND uid = ?", fullpath, folders[idx].OrgID, folders[idx].UID); err != nil {
					mps.log.Error("failed to update fullpath", "err", err, "org_id", folders[idx].OrgID, "uid", folders[idx].UID)
					return err
				}

				return nil
			}); err != nil {
				return folder.ErrInternal.Errorf("failed to update fullpath: %w", err)
			}

			return nil
		}); err != nil {
			return folder.ErrInternal.Errorf("failed to migrate: %w", err)
		}
		return nil
	})
}

func (mps *materializedPathStore) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
	return withUpdateFullpath(ctx, mps, cmd, mps.sqlStore.Create)
}

func (mps *materializedPathStore) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	if cmd.NewParentUID == nil {
		return mps.sqlStore.Update(ctx, cmd)
	}
	return withUpdateFullpath(ctx, mps, cmd, mps.sqlStore.Update)
}

func withUpdateFullpath[T any](ctx context.Context, mps *materializedPathStore, cmd T, fn func(context.Context, T) (*folder.Folder, error)) (*folder.Folder, error) {
	var fldr *folder.Folder
	if err := mps.db.InTransaction(ctx, func(ctx context.Context) error {
		f, err := fn(ctx, cmd)
		if err != nil {
			return err
		}
		fldr = f

		fullpath, err := mps.getFullpath(ctx, f.OrgID, f.UID)
		if err != nil {
			return err
		}

		if err := mps.db.WithDbSession(ctx, func(sess *db.Session) error {
			if _, err := sess.Exec("UPDATE folder SET fullpath = ? WHERE org_id = ? AND uid = ?", fullpath, f.OrgID, f.UID); err != nil {
				mps.log.Error("failed to update fullpath", "err", err, "org_id", f.OrgID, "uid", f.UID)
				return err
			}
			return nil
		}); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}
	return fldr, nil
}
