package folderimpl

import (
	"context"
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

func ProvideDashboardFolderStore(sqlStore db.DB) *DashboardFolderStoreImpl {
	return &DashboardFolderStoreImpl{store: sqlStore}
}

func (d *DashboardFolderStoreImpl) GetFolderByTitle(ctx context.Context, orgID int64, title string, folderUID *string) (*folder.Folder, error) {
	if title == "" {
		return nil, dashboards.ErrFolderTitleEmpty
	}

	// there is a unique constraint on org_id, folder_uid, title
	// there are no nested folders so the parent folder id is always 0
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	dashboard := dashboards.Dashboard{OrgID: orgID, FolderID: 0, Title: title}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		s := sess.Table(&dashboards.Dashboard{}).Where("is_folder = " + d.store.GetDialect().BooleanStr(true))
		if folderUID != nil {
			s = s.Where("folder_uid = ?", *folderUID)
		} else {
			s = s.Where("folder_uid IS NULL")
		}
		has, err := s.Get(&dashboard)
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
	return dashboards.FromDashboard(&dashboard), err
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
