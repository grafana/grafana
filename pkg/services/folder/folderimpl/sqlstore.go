package folderimpl

import (
	"context"
	"encoding/binary"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

type sqlStore struct {
	db  db.DB
	log log.Logger
	cfg *setting.Cfg
	fm  featuremgmt.FeatureManager
}

// sqlStore implements the store interface.
var _ store = (*sqlStore)(nil)

func ProvideStore(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureManager) *sqlStore {
	return &sqlStore{db: db, log: log.New("folder-store"), cfg: cfg, fm: features}
}

func (ss *sqlStore) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	foldr := &folder.Folder{
		OrgID:       cmd.OrgID,
		UID:         cmd.UID,
		ParentUID:   cmd.ParentUID,
		Title:       cmd.Title,
		Description: cmd.Description,
		Created:     time.Now(),
		Updated:     time.Now(),
	}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		folderID, err := sess.Insert(foldr)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to insert folder: %w", err)
		}
		foldr.ID = folderID
		return nil
	})
	return foldr, err
}

func (ss *sqlStore) Delete(ctx context.Context, uid string, orgID int64) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM folder WHERE uid=? AND org_id=?", uid, orgID)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to delete folder: %w", err)
		}
		return nil
	})
}

func (ss *sqlStore) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	cmd.Folder.Updated = time.Now()
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.ID(cmd.Folder.ID).AllCols().Update(cmd.Folder)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to update folder: %w", err)
		}
		return nil
	})

	return cmd.Folder, err
}

func (ss *sqlStore) Get(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error) {
	var foldr *folder.Folder
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Where("uid=? OR id=? OR title=?", cmd.UID, cmd.ID, cmd.Title).Get(foldr)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to get folder: %w", err)
		}
		if !exists {
			return folder.ErrFolderNotFound.Errorf("folder not found")
		}
		return nil
	})
	return foldr, err
}

func (ss *sqlStore) GetParents(ctx context.Context, cmd *folder.GetParentsQuery) ([]*folder.Folder, error) {
	var folders []*folder.Folder
	if ss.db.GetDBType() == migrator.MySQL {
		return ss.getParentsMySQL(ctx, cmd)
	}

	recQuery :=
		`WITH RECURSIVE RecQry AS ( SELECT * FROM folder UNION ALL SELECT f.* FROM folder f INNER JOIN RecQry r ON f.parent_uid = r.uid)
		SELECT * FROM RecQry WHERE uid = ? AND org_id = ?;`

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Query(recQuery)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to get folder parents: %w", err)
		}

		for _, row := range res {
			folders = append(folders, &folder.Folder{
				ID:          int64(binary.BigEndian.Uint64(row["id"])),
				OrgID:       int64(binary.BigEndian.Uint64(row["org_id"])),
				UID:         string(row["uid"]),
				ParentUID:   string(row["parent_uid"]),
				Title:       string(row["title"]),
				Description: string(row["description"]),
				// CreatedBy:   int64(binary.BigEndian.Uint64(row["created_by"])),
			})
		}
		return nil
	})
	return nil, err
}

func (ss *sqlStore) GetChildren(ctx context.Context, cmd *folder.GetTreeQuery) ([]*folder.Folder, error) {
	var folders []*folder.Folder

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Where("parent_uid=? AND org_id=?", cmd.UID, cmd.OrgID).Find(folders)
		if err != nil {
			folder.ErrDatabaseError.Errorf("failed to get folder children: %w", err)
		}
		return nil
	})
	return folders, err
}

func (ss *sqlStore) getParentsMySQL(ctx context.Context, cmd *folder.GetParentsQuery) ([]*folder.Folder, error) {
	var foldrs []*folder.Folder
	var foldr *folder.Folder
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		uid := cmd.UID
		for uid != folder.GeneralFolderUID && len(foldrs) < 8 {
			err := sess.Where("uid=?", uid).Find(foldr)
			if err != nil {
				return folder.ErrDatabaseError.Errorf("failed to get folder parents: %w", err)
			}
			foldrs = append(foldrs, foldr)
			uid = foldr.ParentUID
		}
		return nil
	})
	return foldrs, err
}
