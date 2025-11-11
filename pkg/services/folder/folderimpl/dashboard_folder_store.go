package folderimpl

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

// DashboardStore implements the FolderStore interface
// It fetches folders from the dashboard DB table
type DashboardFolderStoreImpl struct {
	store db.DB
}

func newDashboardFolderStore(sqlStore db.DB) *DashboardFolderStoreImpl {
	return &DashboardFolderStoreImpl{store: sqlStore}
}

func (d *DashboardFolderStoreImpl) GetFolderByID(ctx context.Context, orgID int64, id int64) (*folder.Folder, error) {
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	dashboard := dashboards.Dashboard{OrgID: orgID, FolderID: 0, ID: id}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table(&dashboards.Dashboard{}).Where("is_folder = " + d.store.GetDialect().BooleanStr(true)).Get(&dashboard)
		if err != nil {
			return err
		}
		if !has {
			return dashboards.ErrFolderNotFound
		}
		dashboard.SetID(dashboard.ID)
		dashboard.SetUID(dashboard.UID)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return dashboards.FromDashboard(&dashboard), nil
}

func (d *DashboardFolderStoreImpl) GetFolderByUID(ctx context.Context, orgID int64, uid string) (*folder.Folder, error) {
	if uid == "" {
		return nil, dashboards.ErrDashboardIdentifierNotSet
	}
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	dashboard := dashboards.Dashboard{OrgID: orgID, FolderID: 0, UID: uid}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table(&dashboards.Dashboard{}).Where("is_folder = " + d.store.GetDialect().BooleanStr(true)).Get(&dashboard)
		if err != nil {
			return err
		}
		if !has {
			return dashboards.ErrFolderNotFound
		}
		dashboard.SetID(dashboard.ID)
		dashboard.SetUID(dashboard.UID)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return dashboards.FromDashboard(&dashboard), nil
}

func (d *DashboardFolderStoreImpl) Get(ctx context.Context, q folder.GetFolderQuery) (*folder.Folder, error) {
	foldr := &folder.Folder{}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		exists := false
		var err error
		s := strings.Builder{}
		s.WriteString(`SELECT 
			d.id as id,
			d.org_id as org_id,
			d.uid as uid,
			f0.parent_uid as parent_uid,
			d.title as title,
			f0.created as created,
			f0.updated as updated,
			f0.description as description,
			d.version as version,
			d.created_by as created_by,
			d.updated_by as updated_by,
			d.has_acl as has_acl`)
		if q.WithFullpath {
			s.WriteString(fmt.Sprintf(`, %s AS fullpath`, getFullpathSQL(d.store.GetDialect())))
		}
		if q.WithFullpathUIDs {
			s.WriteString(fmt.Sprintf(`, %s AS fullpath_uids`, getFullapathUIDsSQL(d.store.GetDialect())))
		}
		s.WriteString(" FROM folder f0")
		s.WriteString(" INNER JOIN dashboard d ON f0.uid = d.uid AND f0.org_id = d.org_id")
		if q.WithFullpath || q.WithFullpathUIDs {
			s.WriteString(getFullpathJoinsSQL())
		}
		switch {
		case q.UID != nil:
			s.WriteString(" WHERE f0.uid = ? AND f0.org_id = ?")
			exists, err = sess.SQL(s.String(), q.UID, q.OrgID).Get(foldr)
		// nolint:staticcheck
		case q.ID != nil:
			// main difference from sqlstore.Get is that we join to use d.id instead of f0.id here
			s.WriteString(" WHERE d.id = ?")
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
			// nolint:staticcheck
			exists, err = sess.SQL(s.String(), q.ID).Get(foldr)
		case q.Title != nil:
			s.WriteString(" WHERE f0.title = ? AND f0.org_id = ?")
			args := []any{*q.Title, q.OrgID}
			if q.ParentUID != nil {
				s.WriteString(" AND f0.parent_uid = ?")
				args = append(args, *q.ParentUID)
			} else {
				s.WriteString(" AND f0.parent_uid IS NULL")
			}
			exists, err = sess.SQL(s.String(), args...).Get(foldr)
		default:
			return folder.ErrBadRequest.Errorf("one of ID, UID, or Title must be included in the command")
		}
		if err != nil {
			return folder.ErrDatabaseError.Errorf("failed to get folder: %w", err)
		}
		if !exists {
			return dashboards.ErrFolderNotFound
		}
		return nil
	})

	foldr.Fullpath = strings.TrimLeft(foldr.Fullpath, "/")
	foldr.FullpathUIDs = strings.TrimLeft(foldr.FullpathUIDs, "/")
	return foldr.WithURL(), err
}

// GetFolders returns all folders for the given orgID and UIDs.
// If no UIDs are provided then all folders for the org are returned.
func (d *DashboardFolderStoreImpl) GetFolders(ctx context.Context, orgID int64, uids []string) (map[string]*folder.Folder, error) {
	m := make(map[string]*folder.Folder, len(uids))
	if len(uids) == 0 {
		return m, nil
	}

	var folders []*folder.Folder
	if err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		b := strings.Builder{}
		args := make([]any, 0, len(uids)+1)

		b.WriteString("SELECT * FROM dashboard WHERE org_id=? AND is_folder = " + d.store.GetDialect().BooleanStr(true))
		args = append(args, orgID)

		if len(uids) == 1 {
			b.WriteString(" AND uid=?")
		}

		if len(uids) > 1 {
			b.WriteString(" AND uid IN (" + strings.Repeat("?, ", len(uids)-1) + "?)")
		}

		for _, uid := range uids {
			args = append(args, uid)
		}

		return sess.SQL(b.String(), args...).Find(&folders)
	}); err != nil {
		return nil, err
	}

	for _, f := range folders {
		m[f.UID] = f
	}
	return m, nil
}
