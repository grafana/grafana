package folderimpl

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type sqlStore struct {
	db  db.DB
	log log.Logger
}

// sqlStore implements the store interface.
var _ store = (*sqlStore)(nil)

func newSQLStore(db db.DB) *sqlStore {
	return &sqlStore{db: db, log: log.New("folder-store")}
}

func (ss *sqlStore) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	foldr := &folder.Folder{
		OrgID:       cmd.OrgID,
		UID:         cmd.UID,
		ParentUID:   cmd.ParentUID,
		Title:       cmd.Title,
		Description: cmd.Description,
	}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		folderID, err := sess.Insert(foldr)
		if err != nil {
			return fmt.Errorf("create: %v", err)
		}
		foldr.ID = folderID
		return nil
	})
	return foldr, err
}

func (ss *sqlStore) Delete(ctx context.Context, uid string, orgID int64) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM folder WHERE folder_uid=? AND org_id=?", uid, orgID)
		return err
	})
}

func (ss *sqlStore) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.ID(cmd.Folder.ID).AllCols().Update(cmd.Folder)
		return err
	})

	return cmd.Folder, err
}

func (ss *sqlStore) Get(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error) {
	foldr := &folder.Folder{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Where("org_id=? AND (uid=? OR id=? OR title=?)", cmd.OrgID, cmd.UID, cmd.ID, cmd.Title).Get(foldr)
		if err != nil {
			return err
		}
		if !exists {
			return folder.ErrFolderNotFound.Errorf("folder not found")
		}
		return nil
	})
	return foldr, err
}

func (ss *sqlStore) GetParents(ctx context.Context, cmd *folder.GetParentsQuery) ([]*folder.Folder, error) {
	if ss.db.GetDBType() == migrator.MySQL {
		return ss.getParentsMySQL(ctx, cmd)
	}
	return ss.getParentsCTE(ctx, cmd)
}

func (ss *sqlStore) GetChildren(ctx context.Context, cmd *folder.GetTreeQuery) ([]*folder.Folder, error) {
	var folders []*folder.Folder

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Where("parent_uid=? AND org_id=?", cmd.UID, cmd.OrgID).Find(folders)
		return err
	})
	return folders, err
}

func (ss *sqlStore) getParentsCTE(ctx context.Context, cmd *folder.GetParentsQuery) (folders []*folder.Folder, err error) {
	recQuery := `WITH RECURSIVE parents(id, uid, org_id, title, description, parent_uid, created, updated) AS (
		SELECT * FROM folder WHERE (org_id == ? AND uid == ?) UNION ALL 
		SELECT folder.* FROM folder
			JOIN parents ON (folder.uid=parents.parent_uid AND folder.org_id = parents.org_id)
		) SELECT * FROM parents;`
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(recQuery, cmd.OrgID, cmd.UID).Find(&folders)
	})
	return folders[1:], err
}

func (ss *sqlStore) getParentsMySQL(ctx context.Context, cmd *folder.GetParentsQuery) (folders []*folder.Folder, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		uid := ""
		ok, err := sess.Table("folder").Where("org_id=? AND uid=?", cmd.OrgID, cmd.UID).Cols("parent_uid").Get(&uid)
		if err != nil {
			return err
		}
		if !ok {
			return folder.ErrFolderNotFound
		}
		for {
			f := &folder.Folder{}
			ok, err := sess.Where("org_id=? AND uid=?", cmd.OrgID, uid).Get(f)
			if err != nil {
				return err
			}
			if !ok {
				break
			}
			folders = append(folders, f)
			uid = f.ParentUID
			if len(folders) > 8 {
				return folder.ErrFolderTooDeep
			}
		}
		return nil
	})
	return folders, err
}
