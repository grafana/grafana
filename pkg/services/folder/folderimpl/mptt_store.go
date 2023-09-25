package folderimpl

import (
	"context"
	"runtime"
	"strings"
	"sync/atomic"
	"time"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
)

/*
type HierarchicalEntity[T any] struct {
	a     T
	Left  int64
	Right int64
}

func (h *HierarchicalEntity[T]) GetLeft() int64 {
	return h.Left
}

func (h *HierarchicalEntity[T]) GetRight() int64 {
	return h.Right
}

func (h *HierarchicalEntity[T]) GetEntity() T {
	return h.a
}
*/

type treeStore struct {
	sqlStore
	db  db.DB
	log log.Logger
}

func ProvideTreeStore(db db.DB) *treeStore {
	logger := log.New("folder-store-mptt")
	store := &treeStore{
		db:  db,
		log: logger,
	}
	store.sqlStore = sqlStore{db: db, log: logger}

	//store.populateLeftRightCols(1, nil, 0, 0)
	return store
}

func (hs *treeStore) migrate(ctx context.Context, orgID int64, f *folder.Folder, counter int64) (int64, error) {
	// TODO: run only once
	err := hs.db.InTransaction(ctx, func(ctx context.Context) error {
		var children []*folder.Folder

		q := "SELECT * FROM folder WHERE org_id = ?"
		args := []interface{}{orgID}
		// get children
		if f == nil {
			q = q + "AND parent_uid IS NULL"
		} else {
			q = q + "AND parent_uid = ?"
			args = append(args, f.UID)
		}

		if err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
			if err := sess.SQL(q, args...).Find(&children); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return err
		}

		if len(children) == 0 {
			counter++
			if f != nil {
				f.Rgt = counter
			}
			return nil
		}

		for _, child := range children {
			counter++
			child.Lft = counter
			c, err := hs.migrate(ctx, orgID, child, counter)
			if err != nil {
				return err
			}
			if err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
				// TODO: do not update if the values are the same
				_, err := sess.Exec("UPDATE folder SET lft = ?, rgt = ? WHERE uid = ? AND org_id = ?", child.Lft, child.Rgt, child.UID, child.OrgID)
				if err != nil {
					return err
				}
				return nil
			}); err != nil {
				return err
			}
			counter = c
		}
		counter++
		if f != nil {
			f.Rgt = counter
		}
		return nil
	})

	return counter, err
}

func (hs *treeStore) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
	if cmd.UID == "" {
		return nil, folder.ErrBadRequest.Errorf("missing UID")
	}

	// TODO: fix concurrency
	foldr := &folder.Folder{}
	now := time.Now()
	if err := hs.db.InTransaction(ctx, func(ctx context.Context) error {
		if err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
			if cmd.ParentUID == "" {
				maxRgt := 0
				if _, err := sess.SQL("SELECT  MAX(rgt) FROM folder WHERE org_id = ?", cmd.OrgID).Get(&maxRgt); err != nil {
					return err
				}

				if _, err := sess.Exec("INSERT INTO folder(org_id, uid, title, created, updated, lft, rgt) VALUES(?, ?, ?, ?, ?, ?, ?)", cmd.OrgID, cmd.UID, cmd.Title, now, now, maxRgt+1, maxRgt+2); err != nil {
					return err
				}
				return nil
			}

			var parentRgt int64
			if _, err := sess.SQL("SELECT rgt FROM folder WHERE uid = ? AND org_id = ?", cmd.ParentUID, cmd.OrgID).Get(&parentRgt); err != nil {
				return err
			}

			if r, err := sess.Exec("UPDATE folder SET rgt = rgt + 2 WHERE rgt >= ? AND org_id = ?", parentRgt, cmd.OrgID); err != nil {
				if rowsAffected, err := r.RowsAffected(); err == nil {
					hs.log.Info("Updated rgt column in folder table", "rowsAffected", rowsAffected)
				}
				return err
			}

			if r, err := sess.Exec("UPDATE folder SET lft = lft + 2 WHERE lft > ? AND org_id = ?", parentRgt, cmd.OrgID); err != nil {
				if rowsAffected, err := r.RowsAffected(); err == nil {
					hs.log.Info("Updated lft column in folder table", "rowsAffected", rowsAffected)
				}
				return err
			}

			if _, err := sess.Exec("INSERT INTO folder(org_id, uid, title, created, updated, parent_uid, lft, rgt) VALUES(?, ?, ?, ?, ?, ?, ?, ?)", cmd.OrgID, cmd.UID, cmd.Title, now, now, cmd.ParentUID, parentRgt, parentRgt+1); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return err
		}

		if err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
			if _, err := sess.SQL("SELECT * FROM folder WHERE uid = ? AND org_id = ?", cmd.UID, cmd.OrgID).Get(foldr); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return foldr, err
	}

	return foldr, nil
}

// Delete deletes a folder and all its descendants
func (hs *treeStore) Delete(ctx context.Context, uid string, orgID int64) error {
	if err := hs.db.InTransaction(ctx, func(ctx context.Context) error {
		if err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
			type res struct {
				Lft   int64
				Rgt   int64
				Width int64
			}
			var r res
			if _, err := sess.SQL("SELECT lft, rgt, rgt - lft + 1 AS width FROM folder WHERE uid = ? AND org_id = ?", uid, orgID).Get(&r); err != nil {
				return err
			}

			if _, err := sess.Exec("DELETE FROM folder WHERE lft >= ? AND rgt <= ? AND org_id = ?", r.Lft, r.Rgt, orgID); err != nil {
				return err
			}

			if _, err := sess.Exec("UPDATE folder SET rgt = rgt - ? WHERE rgt > ? AND org_id = ?", r.Width, r.Width, r.Rgt, orgID); err != nil {
				return err
			}

			if _, err := sess.Exec("UPDATE folder SET lft = lft - ? WHERE lft > ? AND org_id = ?", r.Width, r.Width, r.Rgt, orgID); err != nil {
				return err
			}

			return nil
		}); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}
	return nil
}

func (hs *treeStore) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	var foldr *folder.Folder
	var err error
	if err := hs.db.InTransaction(ctx, func(ctx context.Context) error {
		if foldr, err = hs.sqlStore.Update(ctx, cmd); err != nil {
			return err
		}

		// if it's a move operation update the left and right columns of the affected nodes appropriately
		if cmd.NewParentUID != nil {
			if _, err := hs.migrate(ctx, cmd.OrgID, nil, 0); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return foldr, err
	}

	// NOTE: left and right cols are not updated in the foldr object
	return foldr, nil
}

func (hs *treeStore) GetParents(ctx context.Context, cmd folder.GetParentsQuery) ([]*folder.Folder, error) {
	var folders []*folder.Folder
	err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.SQL(`
		SELECT parent.*
		FROM folder AS node,
			folder AS parent
		WHERE node.lft > parent.lft AND node.lft < parent.rgt
			AND node.org_id = ? AND node.uid = ?
		ORDER BY node.lft
		`, cmd.OrgID, cmd.UID).Find(&folders); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return folders, nil
}

func (hs *treeStore) GetHeight(ctx context.Context, foldrUID string, orgID int64, _ *string) (int, error) {
	var subpaths []string
	err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
		// get subpaths of the leaf nodes under the given folder
		s := `SELECT substr(group_concat(parent.uid), instr( group_concat(parent.uid), ?))
		FROM folder AS node,
			folder AS parent
		WHERE node.org_id = ? AND node.lft >= parent.lft AND node.lft <= parent.rgt
		AND node.rgt = node.lft + 1
		GROUP BY node.uid
		HAVING instr( group_concat(parent.uid), ?) > 0
		ORDER BY node.lft`
		if err := sess.SQL(s, foldrUID, orgID, foldrUID).Find(&subpaths); err != nil {
			return err
		}
		return nil
	})

	var height uint32
	concurrency.ForEachJob(ctx, len(subpaths), runtime.NumCPU(), func(ctx context.Context, i int) error {
		v := len(strings.Split(subpaths[i], ",")) - 1
		if v > int(height) {
			atomic.StoreUint32(&height, uint32(v))
		}
		return nil
	})

	return int(height), err
}

func (hs *treeStore) getTree(ctx context.Context, orgID int64) ([]string, error) {
	var tree []string
	err := hs.db.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.SQL(`
		SELECT COUNT(parent.title) || '-' || node.title
		FROM folder AS node, folder AS parent
		WHERE node.lft BETWEEN parent.lft AND parent.rgt AND node.org_id = ?
		GROUP BY node.title
		ORDER BY node.lft
		`, orgID).Find(&tree); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return tree, nil
}
