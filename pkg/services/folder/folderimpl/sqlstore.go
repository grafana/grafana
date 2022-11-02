package folderimpl

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
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

func (ss *sqlStore) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
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
		/*
			affected, err := res.RowsAffected()
			if err != nil {
				return folder.ErrDatabaseError.Errorf("failed to get affected rows: %w", err)
			}
				if affected == 0 {
					return folder.ErrFolderNotFound.Errorf("folder not found uid:%s org_id:%d", uid, orgID)
				}
		*/
		return nil
	})
}

func (ss *sqlStore) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	if cmd.Folder == nil {
		return nil, folder.ErrBadRequest.Errorf("invalid update command: missing folder")
	}

	cmd.Folder.Updated = time.Now()
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		description := cmd.Folder.Description
		if cmd.NewDescription != nil {
			description = *cmd.NewDescription
		}

		title := cmd.Folder.Title
		if cmd.NewTitle != nil {
			title = *cmd.NewTitle
		}

		uid := cmd.Folder.UID
		if cmd.NewUID != nil {
			uid = *cmd.NewUID
		}

		_, err := sess.ID(cmd.Folder.ID).AllCols().Update(cmd.Folder)
		res, err := sess.Exec("UPDATE folder SET description = ?, title = ?, uid = ?, updated = ? WHERE uid = ? AND org_id = ?", description, title, uid, cmd.Folder.Updated, cmd.Folder.UID, cmd.Folder.OrgID)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to update folder: %w", err)
		}

		affected, err := res.RowsAffected()
		if err != nil {
			return folder.ErrInternal.Errorf("failed to get affected row: %w", err)
		}
		if affected == 0 {
			return folder.ErrInternal.Errorf("no folders are updated")
		}

		cmd.Folder.Description = description
		cmd.Folder.Title = title
		cmd.Folder.UID = uid
		return nil
	})

	return cmd.Folder, err
}

func (ss *sqlStore) Get(ctx context.Context, q folder.GetFolderQuery) (*folder.Folder, error) {
	foldr := &folder.Folder{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exists := false
		var err error

		switch {
		case q.ID != nil:
			exists, err = sess.SQL("SELECT * FROM folder WHERE id = ?", q.ID).Get(foldr)
		case q.Title != nil:
			exists, err = sess.SQL("SELECT * FROM folder WHERE title = ? AND org_id = ?", q.Title, q.OrgID).Get(foldr)
		case q.UID != nil:
			exists, err = sess.SQL("SELECT * FROM folder WHERE uid = ? AND org_id = ?", q.UID, q.OrgID).Get(foldr)
		default:
			return folder.ErrBadRequest.Errorf("one of ID, UID, or Title must be included in the command")
		}
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

func (ss *sqlStore) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	var folders []*folder.Folder
	if ss.db.GetDBType() == migrator.MySQL {
		return ss.getParentsMySQL(ctx, q)
	}

	recQuery := `
		WITH RECURSIVE RecQry AS (
			SELECT * FROM folder WHERE uid = ? AND org_id = ?
			UNION ALL SELECT f.* FROM folder f INNER JOIN RecQry r ON f.uid = r.parent_uid and f.org_id = r.org_id
		)
		SELECT * FROM RecQry;
	`

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.SQL(recQuery, q.UID, q.OrgID).Find(&folders)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to get folder parents: %w", err)
		}
		return nil
	})
	return util.Reverse(folders[1:]), err
}

func (ss *sqlStore) GetChildren(ctx context.Context, q folder.GetTreeQuery) ([]*folder.Folder, error) {
	var folders []*folder.Folder

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sql := strings.Builder{}
		sql.Write([]byte("SELECT * FROM folder WHERE parent_uid=? AND org_id=?"))

		if q.Limit != 0 {
			var offset int64 = 1
			if q.Page != 0 {
				offset = q.Page
			}
			sql.Write([]byte(ss.db.GetDialect().LimitOffset(q.Limit, offset)))
		}
		err := sess.SQL(sql.String(), q.UID, q.OrgID).Find(&folders)
		if err != nil {
			folder.ErrDatabaseError.Errorf("failed to get folder children: %w", err)
		}
		return nil
	})
	return folders, err
}

func (ss *sqlStore) getParentsMySQL(ctx context.Context, cmd folder.GetParentsQuery) ([]*folder.Folder, error) {
	var foldrs []*folder.Folder
	var foldr *folder.Folder
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		uid := cmd.UID
		for uid != folder.GeneralFolderUID && len(foldrs) < 8 {
			err := sess.Where("uid=? AND org_id=>", uid, cmd.OrgID).Find(foldr)
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
