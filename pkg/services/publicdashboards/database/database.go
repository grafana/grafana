package database

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// Define the storage implementation. We're generating the mock implementation
// automatically
type PublicDashboardStoreImpl struct {
	sqlStore db.DB
	log      log.Logger
}

var LogPrefix = "publicdashboards.store"

// Gives us a compile time error if our database does not adhere to contract of
// the interface
var _ publicdashboards.Store = (*PublicDashboardStoreImpl)(nil)

// Factory used by wire to dependency injection
func ProvideStore(sqlStore db.DB) *PublicDashboardStoreImpl {
	return &PublicDashboardStoreImpl{
		sqlStore: sqlStore,
		log:      log.New(LogPrefix),
	}
}

// FindAll Returns a list of public dashboards by orgId
func (d *PublicDashboardStoreImpl) FindAll(ctx context.Context, orgId int64) ([]PublicDashboardListResponse, error) {
	resp := make([]PublicDashboardListResponse, 0)

	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		sess.Table("dashboard_public").Select(
			"dashboard_public.uid, dashboard_public.access_token, dashboard.uid as dashboard_uid, dashboard_public.is_enabled, dashboard.title").
			Join("LEFT", "dashboard", "dashboard.uid = dashboard_public.dashboard_uid AND dashboard.org_id = dashboard_public.org_id").
			Where("dashboard_public.org_id = ?", orgId).
			OrderBy(" is_enabled DESC, dashboard.title IS NULL, dashboard.title ASC")

		err := sess.Find(&resp)
		return err
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

// FindDashboard returns a dashboard by orgId and dashboardUid
func (d *PublicDashboardStoreImpl) FindDashboard(ctx context.Context, orgId int64, dashboardUid string) (*dashboards.Dashboard, error) {
	dashboard := &dashboards.Dashboard{OrgID: orgId, UID: dashboardUid}

	var found bool
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		found, err = sess.Get(dashboard)
		return err
	})

	if err != nil {
		return nil, err
	}

	if !found {
		return nil, nil
	}

	return dashboard, nil
}

// Find Returns public dashboard by Uid or nil if not found
func (d *PublicDashboardStoreImpl) Find(ctx context.Context, uid string) (*PublicDashboard, error) {
	if uid == "" {
		return nil, nil
	}

	var found bool
	publicDashboard := &PublicDashboard{Uid: uid}
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		found, err = sess.Get(publicDashboard)
		return err
	})

	if err != nil {
		return nil, err
	}

	if !found {
		return nil, nil
	}

	return publicDashboard, nil
}

// FindByAccessToken Returns public dashboard by access token or nil if not found
func (d *PublicDashboardStoreImpl) FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error) {
	if accessToken == "" {
		return nil, nil
	}

	var found bool
	publicDashboard := &PublicDashboard{AccessToken: accessToken}
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		found, err = sess.Get(publicDashboard)
		return err
	})

	if err != nil {
		return nil, err
	}

	if !found {
		return nil, nil
	}

	return publicDashboard, nil
}

// FindByDashboardUid Retrieves public dashboard by dashboard uid or nil if not found
func (d *PublicDashboardStoreImpl) FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	if dashboardUid == "" || orgId == 0 {
		return nil, nil
	}
	var found bool
	publicDashboard := &PublicDashboard{OrgId: orgId, DashboardUid: dashboardUid}
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		found, err = sess.Get(publicDashboard)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	if !found {
		return nil, nil
	}

	return publicDashboard, nil
}

// ExistsEnabledByDashboardUid Responds true if there is an enabled public dashboard for a dashboard uid
func (d *PublicDashboardStoreImpl) ExistsEnabledByDashboardUid(ctx context.Context, dashboardUid string) (bool, error) {
	hasPublicDashboard := false
	err := d.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := "SELECT COUNT(*) FROM dashboard_public WHERE dashboard_uid=? AND is_enabled=true"

		result, err := dbSession.SQL(sql, dashboardUid).Count()
		if err != nil {
			return err
		}

		hasPublicDashboard = result > 0
		return err
	})

	return hasPublicDashboard, err
}

// ExistsEnabledByAccessToken Responds true if the accessToken exists and the public dashboard is enabled
func (d *PublicDashboardStoreImpl) ExistsEnabledByAccessToken(ctx context.Context, accessToken string) (bool, error) {
	hasPublicDashboard := false
	err := d.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := "SELECT COUNT(*) FROM dashboard_public WHERE access_token=? AND is_enabled=true"

		result, err := dbSession.SQL(sql, accessToken).Count()
		if err != nil {
			return err
		}

		hasPublicDashboard = result > 0
		return err
	})

	return hasPublicDashboard, err
}

// GetOrgIdByAccessToken Returns the public dashboard OrgId if exists.
func (d *PublicDashboardStoreImpl) GetOrgIdByAccessToken(ctx context.Context, accessToken string) (int64, error) {
	var orgId int64
	err := d.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := "SELECT org_id FROM dashboard_public WHERE access_token=?"

		_, err := dbSession.SQL(sql, accessToken).Get(&orgId)
		if err != nil {
			return err
		}

		return err
	})

	return orgId, err
}

// Creates a public dashboard
func (d *PublicDashboardStoreImpl) Create(ctx context.Context, cmd SavePublicDashboardCommand) (int64, error) {
	if cmd.PublicDashboard.DashboardUid == "" {
		return 0, dashboards.ErrDashboardIdentifierNotSet
	}

	var affectedRows int64
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		affectedRows, err = sess.UseBool("is_enabled").Insert(&cmd.PublicDashboard)
		return err
	})

	return affectedRows, err
}

// Updates existing public dashboard
func (d *PublicDashboardStoreImpl) Update(ctx context.Context, cmd SavePublicDashboardCommand) (int64, error) {
	var affectedRows int64
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		timeSettingsJSON, err := json.Marshal(cmd.PublicDashboard.TimeSettings)
		if err != nil {
			return err
		}

		sqlResult, err := sess.Exec("UPDATE dashboard_public SET is_enabled = ?, annotations_enabled = ?, time_selection_enabled = ?, share = ?, time_settings = ?, updated_by = ?, updated_at = ? WHERE uid = ?",
			cmd.PublicDashboard.IsEnabled,
			cmd.PublicDashboard.AnnotationsEnabled,
			cmd.PublicDashboard.TimeSelectionEnabled,
			cmd.PublicDashboard.Share,
			string(timeSettingsJSON),
			cmd.PublicDashboard.UpdatedBy,
			cmd.PublicDashboard.UpdatedAt.UTC().Format("2006-01-02 15:04:05"),
			cmd.PublicDashboard.Uid)

		if err != nil {
			return err
		}

		affectedRows, err = sqlResult.RowsAffected()

		return err
	})

	return affectedRows, err
}

// Deletes a public dashboard
func (d *PublicDashboardStoreImpl) Delete(ctx context.Context, uid string) (int64, error) {
	dashboard := &PublicDashboard{Uid: uid}
	var affectedRows int64
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		affectedRows, err = sess.Delete(dashboard)

		return err
	})

	return affectedRows, err
}

func (d *PublicDashboardStoreImpl) FindByDashboardFolder(ctx context.Context, dashboard *dashboards.Dashboard) ([]*PublicDashboard, error) {
	if dashboard == nil || !dashboard.IsFolder {
		return nil, nil
	}

	var pubdashes []*PublicDashboard

	err := d.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.SQL("SELECT * from dashboard_public WHERE (dashboard_uid, org_id) IN (SELECT uid, org_id FROM dashboard WHERE folder_id = ?)", dashboard.ID).Find(&pubdashes)
	})
	if err != nil {
		return nil, err
	}

	return pubdashes, nil
}

func (d *PublicDashboardStoreImpl) GetMetrics(ctx context.Context) (*Metrics, error) {
	metrics := &Metrics{
		TotalPublicDashboards: []*TotalPublicDashboard{},
	}
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL("SELECT COUNT(*) as total_count, is_enabled, share as share_type  FROM dashboard_public GROUP BY  is_enabled, share").Find(&metrics.TotalPublicDashboards)
	})
	if err != nil {
		return nil, err
	}

	return metrics, nil
}
