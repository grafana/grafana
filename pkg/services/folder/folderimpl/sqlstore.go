package folderimpl

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type sqlStore struct {
	db  db.DB
	log log.Logger
	cfg *setting.Cfg
	fm  featuremgmt.FeatureToggles
}

// sqlStore implements the store interface.
var _ store = (*sqlStore)(nil)

func ProvideStore(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) *sqlStore {
	return &sqlStore{db: db, log: log.New("folder-store"), cfg: cfg, fm: features}
}

func (ss *sqlStore) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
	if cmd.UID == "" {
		return nil, folder.ErrBadRequest.Errorf("missing UID")
	}

	var foldr *folder.Folder
	/*
		version := 1
		updatedBy := cmd.SignedInUser.UserID
		createdBy := cmd.SignedInUser.UserID
	*/
	var lastInsertedID int64
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var sql string
		var args []interface{}
		if cmd.ParentUID == "" {
			sql = "INSERT INTO folder(org_id, uid, title, description, created, updated) VALUES(?, ?, ?, ?, ?, ?)"
			args = []interface{}{cmd.OrgID, cmd.UID, cmd.Title, cmd.Description, time.Now(), time.Now()}
		} else {
			if cmd.ParentUID != folder.GeneralFolderUID {
				if _, err := ss.Get(ctx, folder.GetFolderQuery{
					UID:   &cmd.ParentUID,
					OrgID: cmd.OrgID,
				}); err != nil {
					return folder.ErrFolderNotFound.Errorf("parent folder does not exist")
				}
			}
			sql = "INSERT INTO folder(org_id, uid, parent_uid, title, description, created, updated) VALUES(?, ?, ?, ?, ?, ?, ?)"
			args = []interface{}{cmd.OrgID, cmd.UID, cmd.ParentUID, cmd.Title, cmd.Description, time.Now(), time.Now()}
		}

		var err error
		lastInsertedID, err = sess.WithReturningID(ss.db.GetDialect().DriverName(), sql, args)
		if err != nil {
			return err
		}

		foldr, err = ss.Get(ctx, folder.GetFolderQuery{
			ID: &lastInsertedID,
		})
		if err != nil {
			return err
		}
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

func (ss *sqlStore) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	updated := time.Now()
	uid := cmd.UID

	var foldr *folder.Folder
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sql := strings.Builder{}
		sql.Write([]byte("UPDATE folder SET "))
		columnsToUpdate := []string{"updated = ?"}
		args := []interface{}{updated}
		if cmd.NewDescription != nil {
			columnsToUpdate = append(columnsToUpdate, "description = ?")
			args = append(args, *cmd.NewDescription)
		}

		if cmd.NewTitle != nil {
			columnsToUpdate = append(columnsToUpdate, "title = ?")
			args = append(args, *cmd.NewTitle)
		}

		if cmd.NewUID != nil {
			columnsToUpdate = append(columnsToUpdate, "uid = ?")
			uid = *cmd.NewUID
			args = append(args, *cmd.NewUID)
		}

		if cmd.NewParentUID != nil {
			columnsToUpdate = append(columnsToUpdate, "parent_uid = ?")
			args = append(args, *cmd.NewParentUID)
		} else {
			columnsToUpdate = append(columnsToUpdate, "parent_uid = NULL")
		}

		if len(columnsToUpdate) == 0 {
			return folder.ErrBadRequest.Errorf("no columns to update")
		}

		sql.Write([]byte(strings.Join(columnsToUpdate, ", ")))
		sql.Write([]byte(" WHERE uid = ? AND org_id = ?"))
		args = append(args, cmd.UID, cmd.OrgID)

		args = append([]interface{}{sql.String()}, args...)

		res, err := sess.Exec(args...)
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

		foldr, err = ss.Get(ctx, folder.GetFolderQuery{
			UID:   &uid,
			OrgID: cmd.OrgID,
		})
		if err != nil {
			return err
		}
		return nil
	})

	return foldr, err
}

func (ss *sqlStore) Get(ctx context.Context, q folder.GetFolderQuery) (*folder.Folder, error) {
	foldr := &folder.Folder{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exists := false
		var err error
		switch {
		case q.UID != nil:
			exists, err = sess.SQL("SELECT * FROM folder WHERE uid = ? AND org_id = ?", q.UID, q.OrgID).Get(foldr)
		case q.ID != nil:
			exists, err = sess.SQL("SELECT * FROM folder WHERE id = ?", q.ID).Get(foldr)
		case q.Title != nil:
			exists, err = sess.SQL("SELECT * FROM folder WHERE title = ? AND org_id = ?", q.Title, q.OrgID).Get(foldr)
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
	foldr.URL = dashboards.GetFolderURL(foldr.UID, slugify.Slugify(foldr.Title))
	return foldr, err
}

func (ss *sqlStore) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	if q.UID == "" {
		return []*folder.Folder{}, nil
	}
	var folders []*folder.Folder

	recQuery := `
		WITH RECURSIVE RecQry AS (
			SELECT * FROM folder WHERE uid = ? AND org_id = ?
			UNION ALL SELECT f.* FROM folder f INNER JOIN RecQry r ON f.uid = r.parent_uid and f.org_id = r.org_id
		)
		SELECT * FROM RecQry;
	`

	recursiveQueriesAreSupported, err := ss.db.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}
	switch recursiveQueriesAreSupported {
	case true:
		if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
			err := sess.SQL(recQuery, q.UID, q.OrgID).Find(&folders)
			if err != nil {
				return folder.ErrDatabaseError.Errorf("failed to get folder parents: %w", err)
			}
			return nil
		}); err != nil {
			return nil, err
		}
	default:
		ss.log.Debug("recursive CTE subquery is not supported; it fallbacks to the iterative implementation")
		return ss.getParentsMySQL(ctx, q)
	}

	if len(folders) < 1 {
		// the query is expected to return at least the same folder
		// if it's empty it means that the folder does not exist
		return nil, folder.ErrFolderNotFound
	}

	return util.Reverse(folders[1:]), nil
}

func (ss *sqlStore) GetChildren(ctx context.Context, q folder.GetChildrenQuery) ([]*folder.Folder, error) {
	var folders []*folder.Folder

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sql := strings.Builder{}
		args := make([]interface{}, 0, 2)
		if q.UID == "" {
			sql.Write([]byte("SELECT * FROM folder WHERE parent_uid IS NULL AND org_id=?"))
			args = append(args, q.OrgID)
		} else {
			sql.Write([]byte("SELECT * FROM folder WHERE parent_uid=? AND org_id=?"))
			args = append(args, q.UID, q.OrgID)
		}

		if q.Limit != 0 {
			var offset int64 = 0
			if q.Page > 0 {
				offset = q.Limit * (q.Page - 1)
			}
			sql.Write([]byte(ss.db.GetDialect().LimitOffset(q.Limit, offset)))
		}
		err := sess.SQL(sql.String(), args...).Find(&folders)
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to get folder children: %w", err)
		}
		return nil
	})
	return folders, err
}

func (ss *sqlStore) getParentsMySQL(ctx context.Context, cmd folder.GetParentsQuery) (folders []*folder.Folder, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		uid := ""
		ok, err := sess.SQL("SELECT parent_uid FROM folder WHERE org_id=? AND uid=?", cmd.OrgID, cmd.UID).Get(&uid)
		if err != nil {
			return err
		}
		if !ok {
			return folder.ErrFolderNotFound
		}
		for {
			f := &folder.Folder{}
			ok, err := sess.SQL("SELECT * FROM folder WHERE org_id=? AND uid=?", cmd.OrgID, uid).Get(f)
			if err != nil {
				return err
			}
			if !ok {
				break
			}
			folders = append(folders, f)
			uid = f.ParentUID
			if len(folders) > folder.MaxNestedFolderDepth {
				return folder.ErrFolderTooDeep
			}
		}
		return nil
	})
	return util.Reverse(folders), err
}

func (ss *sqlStore) GetHeight(ctx context.Context, foldrUID string, orgID int64, parentUID *string) (int, error) {
	height := -1
	queue := []string{foldrUID}
	for len(queue) > 0 && height <= folder.MaxNestedFolderDepth {
		length := len(queue)
		height++
		for i := 0; i < length; i++ {
			ele := queue[0]
			queue = queue[1:]
			if parentUID != nil && *parentUID == ele {
				return 0, folder.ErrCircularReference
			}
			folders, err := ss.GetChildren(ctx, folder.GetChildrenQuery{UID: ele, OrgID: orgID})
			if err != nil {
				return 0, err
			}
			for _, f := range folders {
				queue = append(queue, f.UID)
			}
		}
	}
	if height > folder.MaxNestedFolderDepth {
		ss.log.Warn("folder height exceeds the maximum allowed depth, You might have a circular reference", "uid", foldrUID, "orgId", orgID, "maxDepth", folder.MaxNestedFolderDepth)
	}
	return height, nil
}
