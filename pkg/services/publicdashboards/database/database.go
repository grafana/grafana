package database

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/setting"
)

// Define the storage implementation. We're generating the mock implementation
// automatically
type PublicDashboardStoreImpl struct {
	sqlStore db.DB
	log      log.Logger
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
}

var LogPrefix = "publicdashboards.store"

// Gives us a compile time error if our database does not adhere to contract of
// the interface
var _ publicdashboards.Store = (*PublicDashboardStoreImpl)(nil)

// Factory used by wire to dependency injection
func ProvideStore(sqlStore db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) *PublicDashboardStoreImpl {
	return &PublicDashboardStoreImpl{
		sqlStore: sqlStore,
		log:      log.New(LogPrefix),
		cfg:      cfg,
		features: features,
	}
}

// FindAllWithPagination Returns a list of public dashboards by orgId, based on permissions and with pagination
func (d *PublicDashboardStoreImpl) FindAll(ctx context.Context, query *PublicDashboardListQuery) (*PublicDashboardListResponseWithPagination, error) {
	resp := &PublicDashboardListResponseWithPagination{
		PublicDashboards: make([]*PublicDashboardListResponse, 0),
		TotalCount:       0,
	}

	recursiveQueriesAreSupported, err := d.sqlStore.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	pubdashBuilder := db.NewSqlBuilder(d.cfg, d.features, d.sqlStore.GetDialect(), recursiveQueriesAreSupported)
	pubdashBuilder.Write("SELECT uid, access_token, dashboard_uid, is_enabled")
	pubdashBuilder.Write(" FROM dashboard_public")
	pubdashBuilder.Write(` WHERE org_id = ?`, query.OrgID)

	counterBuilder := db.NewSqlBuilder(d.cfg, d.features, d.sqlStore.GetDialect(), recursiveQueriesAreSupported)
	counterBuilder.Write("SELECT COUNT(*)")
	counterBuilder.Write(" FROM dashboard_public")
	counterBuilder.Write(` WHERE org_id = ?`, query.OrgID)

	err = d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.SQL(pubdashBuilder.GetSQLString(), pubdashBuilder.GetParams()...).Find(&resp.PublicDashboards)
		if err != nil {
			return err
		}

		_, err = sess.SQL(counterBuilder.GetSQLString(), counterBuilder.GetParams()...).Get(&resp.TotalCount)
		return err
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
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
			cmd.PublicDashboard.UpdatedAt.UTC(),
			cmd.PublicDashboard.Uid)

		if err != nil {
			return err
		}

		affectedRows, err = sqlResult.RowsAffected()

		return err
	})

	return affectedRows, err
}

// Delete deletes a public dashboard
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

// DeleteByDashboardUIDs deletes public dashboards by dashboard uids
func (d *PublicDashboardStoreImpl) DeleteByDashboardUIDs(ctx context.Context, orgId int64, dashboardUIDs []string) error {
	if len(dashboardUIDs) == 0 {
		return nil
	}

	return d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		s := strings.Builder{}
		s.WriteString("DELETE FROM dashboard_public WHERE org_id = ? AND ")
		s.WriteString(fmt.Sprintf("dashboard_uid IN (%s)", strings.Repeat("?,", len(dashboardUIDs)-1)+"?"))
		sql := s.String()
		args := make([]any, 0, len(dashboardUIDs)+2)
		args = append(args, sql)
		args = append(args, orgId)
		for _, dashboardUID := range dashboardUIDs {
			args = append(args, dashboardUID)
		}

		_, err := sess.Exec(args...)

		return err
	})
}

func (d *PublicDashboardStoreImpl) GetMetrics(ctx context.Context) (*Metrics, error) {
	metrics := &Metrics{
		TotalPublicDashboards: []*TotalPublicDashboard{},
	}
	err := d.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL("SELECT COUNT(*) as total_count, is_enabled, share as share_type  FROM dashboard_public GROUP BY is_enabled, share").Find(&metrics.TotalPublicDashboards)
	})
	if err != nil {
		return nil, err
	}

	return metrics, nil
}
