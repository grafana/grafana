package statsimpl

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/setting"
)

const activeUserTimeLimit = time.Hour * 24 * 30
const dailyActiveUserTimeLimit = time.Hour * 24

func ProvideService(cfg *setting.Cfg, db db.DB, dashSvc dashboards.DashboardService, folderSvc folder.Service, orgSvc org.Service, features featuremgmt.FeatureToggles) stats.Service {
	return &sqlStatsService{
		cfg:       cfg,
		db:        db,
		folderSvc: folderSvc,
		dashSvc:   dashSvc,
		orgSvc:    orgSvc,
		features:  features,
	}
}

type sqlStatsService struct {
	db        db.DB
	cfg       *setting.Cfg
	dashSvc   dashboards.DashboardService
	features  featuremgmt.FeatureToggles
	folderSvc folder.Service
	orgSvc    org.Service
}

func (ss *sqlStatsService) getDashboardCount(ctx context.Context, orgs []*org.OrgDTO) (int64, error) {
	count := int64(0)
	for _, org := range orgs {
		ctx, _ = identity.WithServiceIdentity(ctx, org.ID)
		dashsCount, err := ss.dashSvc.CountDashboardsInOrg(ctx, org.ID)
		if err != nil {
			return 0, err
		}
		count += dashsCount
	}
	return count, nil
}

func (ss *sqlStatsService) getTagCount(ctx context.Context, orgs []*org.OrgDTO) (int64, error) {
	total := 0
	for _, org := range orgs {
		ctx, _ = identity.WithServiceIdentity(ctx, org.ID)
		tags, err := ss.dashSvc.GetDashboardTags(ctx, &dashboards.GetDashboardTagsQuery{
			OrgID: org.ID,
		})
		if err != nil {
			return 0, err
		}
		total += len(tags)
	}

	return int64(total), nil
}

func (ss *sqlStatsService) getFolderCount(ctx context.Context, orgs []*org.OrgDTO) (int64, error) {
	total := int64(0)
	for _, org := range orgs {
		ctx, _ = identity.WithServiceIdentity(ctx, org.ID)
		folderCount, err := ss.folderSvc.CountFoldersInOrg(ctx, org.ID)
		if err != nil {
			return 0, err
		}
		total += folderCount
	}
	return total, nil
}

func (ss *sqlStatsService) GetAlertNotifiersUsageStats(ctx context.Context, query *stats.GetAlertNotifierUsageStatsQuery) (result []*stats.NotifierUsageStats, err error) {
	err = ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var rawSQL = `SELECT COUNT(*) AS count, type FROM ` + ss.db.GetDialect().Quote("alert_notification") + ` GROUP BY type`
		result = make([]*stats.NotifierUsageStats, 0)
		err := dbSession.SQL(rawSQL).Find(&result)
		return err
	})
	return result, err
}

func (ss *sqlStatsService) GetDataSourceStats(ctx context.Context, query *stats.GetDataSourceStatsQuery) (result []*stats.DataSourceStats, err error) {
	err = ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var rawSQL = `SELECT COUNT(*) AS count, type FROM ` + ss.db.GetDialect().Quote("data_source") + ` GROUP BY type`
		result = make([]*stats.DataSourceStats, 0)
		err := dbSession.SQL(rawSQL).Find(&result)
		return err
	})
	return result, err
}

func (ss *sqlStatsService) GetDataSourceAccessStats(ctx context.Context, query *stats.GetDataSourceAccessStatsQuery) (result []*stats.DataSourceAccessStats, err error) {
	err = ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var rawSQL = `SELECT COUNT(*) AS count, type, access FROM ` + ss.db.GetDialect().Quote("data_source") + ` GROUP BY type, access`
		result = make([]*stats.DataSourceAccessStats, 0)
		err := dbSession.SQL(rawSQL).Find(&result)
		return err
	})
	return result, err
}

func notServiceAccount(dialect migrator.Dialect) string {
	return `is_service_account = ` +
		dialect.BooleanStr(false)
}

func (ss *sqlStatsService) GetSystemStats(ctx context.Context, query *stats.GetSystemStatsQuery) (result *stats.SystemStats, err error) {
	dialect := ss.db.GetDialect()
	err = ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		sb := &db.SQLBuilder{}
		sb.Write("SELECT ")
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + `) AS users,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("data_source") + `) AS datasources,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("star") + `) AS stars,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("playlist") + `) AS playlists,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("alert") + `) AS alerts,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("correlation") + `) AS correlations,`)

		now := time.Now()
		activeUserDeadlineDate := now.Add(-activeUserTimeLimit)
		sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` WHERE `+
			notServiceAccount(dialect)+` AND last_seen_at > ?) AS active_users,`, activeUserDeadlineDate)

		dailyActiveUserDeadlineDate := now.Add(-dailyActiveUserTimeLimit)
		sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` WHERE `+
			notServiceAccount(dialect)+` AND last_seen_at > ?) AS daily_active_users,`, dailyActiveUserDeadlineDate)

		monthlyActiveUserDeadlineDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` WHERE `+
			notServiceAccount(dialect)+` AND last_seen_at > ?) AS monthly_active_users,`, monthlyActiveUserDeadlineDate)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_provisioning") + `) AS provisioned_dashboards,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_snapshot") + `) AS snapshots,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_version") + `) AS dashboard_versions,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("annotation") + `) AS annotations,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("team") + `) AS teams,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("user_auth_token") + `) AS auth_tokens,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("alert_rule") + `) AS alert_rules,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("api_key") + `WHERE service_account_id IS NULL) AS api_keys,`)
		sb.Write(`(SELECT COUNT(id) FROM `+dialect.Quote("library_element")+` WHERE kind = ?) AS library_panels,`, model.PanelElement)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("data_keys") + `) AS data_keys,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("data_keys") + `WHERE active = true) AS active_data_keys,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("dashboard_public") + `) AS public_dashboards,`)
		sb.Write(`(SELECT MIN(timestamp) FROM ` + dialect.Quote("migration_log") + `) AS database_created_time,`)
		if ss.IsUnifiedAlertingEnabled() {
			sb.Write(`(SELECT COUNT(DISTINCT (` + dialect.Quote("rule_group") + `)) FROM ` + dialect.Quote("alert_rule") + `) AS rule_groups,`)
		}

		sb.Write(ss.roleCounterSQL(ctx))

		var stats stats.SystemStats
		_, err := dbSession.SQL(sb.GetSQLString(), sb.GetParams()...).Get(&stats)
		if err != nil {
			return err
		}

		result = &stats

		result.DatabaseDriver = dialect.DriverName()

		return nil
	})
	if err != nil {
		return result, err
	}

	orgs, err := ss.orgSvc.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return result, err
	}
	result.Orgs = int64(len(orgs))

	// for services in unified storage, get the stats through the service rather than the db directly
	dashCount, err := ss.getDashboardCount(ctx, orgs)
	if err != nil {
		return result, err
	}
	result.Dashboards = dashCount

	folderCount, err := ss.getFolderCount(ctx, orgs)
	if err != nil {
		return result, err
	}
	result.Folders = folderCount

	return result, err
}

func (ss *sqlStatsService) roleCounterSQL(ctx context.Context) string {
	const roleCounterTimeout = 20 * time.Second
	ctx, cancel := context.WithTimeout(ctx, roleCounterTimeout)
	defer cancel()
	_ = ss.updateUserRoleCountsIfNecessary(ctx, false)
	sqlQuery :=
		strconv.FormatInt(userStatsCache.total.Admins, 10) + ` AS admins, ` +
			strconv.FormatInt(userStatsCache.total.Editors, 10) + ` AS editors, ` +
			strconv.FormatInt(userStatsCache.total.Viewers, 10) + ` AS viewers, ` +
			strconv.FormatInt(userStatsCache.active.Admins, 10) + ` AS active_admins, ` +
			strconv.FormatInt(userStatsCache.active.Editors, 10) + ` AS active_editors, ` +
			strconv.FormatInt(userStatsCache.active.Viewers, 10) + ` AS active_viewers, ` +
			strconv.FormatInt(userStatsCache.dailyActive.Admins, 10) + ` AS daily_active_admins, ` +
			strconv.FormatInt(userStatsCache.dailyActive.Editors, 10) + ` AS daily_active_editors, ` +
			strconv.FormatInt(userStatsCache.dailyActive.Viewers, 10) + ` AS daily_active_viewers`

	return sqlQuery
}

func (ss *sqlStatsService) GetAdminStats(ctx context.Context, query *stats.GetAdminStatsQuery) (result *stats.AdminStats, err error) {
	err = ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		dialect := ss.db.GetDialect()
		now := time.Now()
		activeEndDate := now.Add(-activeUserTimeLimit)
		dailyActiveEndDate := now.Add(-dailyActiveUserTimeLimit)
		monthlyActiveEndDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

		alertsQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", dialect.Quote("alert"))
		if ss.IsUnifiedAlertingEnabled() {
			alertsQuery = fmt.Sprintf("SELECT COUNT(*) FROM %s", dialect.Quote("alert_rule"))
		}

		var rawSQL = `SELECT
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("dashboard_snapshot") + `
		) AS snapshots,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("data_source") + `
		) AS datasources,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("playlist") + `
		) AS playlists,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("star") + `
		) AS stars,
		(` + alertsQuery + ` ) AS alerts,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + `
		) AS users,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + ` AND last_seen_at > ?
		) AS active_users,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + ` AND last_seen_at > ?
		) AS daily_active_users,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + ` AND last_seen_at > ?
		) AS monthly_active_users,
		` + ss.roleCounterSQL(ctx) + `,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user_auth_token") + ` WHERE rotated_at > ?
		) AS active_sessions,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user_auth_token") + ` WHERE rotated_at > ?
		) AS daily_active_sessions`

		var stats stats.AdminStats
		_, err := dbSession.SQL(rawSQL, activeEndDate, dailyActiveEndDate, monthlyActiveEndDate, activeEndDate.Unix(), dailyActiveEndDate.Unix()).Get(&stats)
		if err != nil {
			return err
		}

		result = &stats
		return nil
	})
	if err != nil {
		return result, err
	}

	orgs, err := ss.orgSvc.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return result, err
	}
	result.Orgs = int64(len(orgs))

	// for services in unified storage, get the stats through the service rather than the db directly
	dashCount, err := ss.getDashboardCount(ctx, orgs)
	if err != nil {
		return result, err
	}
	result.Dashboards = dashCount

	tagCount, err := ss.getTagCount(ctx, orgs)
	if err != nil {
		return result, err
	}
	result.Tags = tagCount

	return result, err
}

func (ss *sqlStatsService) GetSystemUserCountStats(ctx context.Context, query *stats.GetSystemUserCountStatsQuery) (result *stats.SystemUserCountStats, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = `SELECT COUNT(id) AS Count FROM ` + ss.db.GetDialect().Quote("user")
		var stats stats.SystemUserCountStats
		_, err := sess.SQL(rawSQL).Get(&stats)
		if err != nil {
			return err
		}

		result = &stats

		return nil
	})
	return result, err
}

func (ss *sqlStatsService) IsUnifiedAlertingEnabled() bool {
	return ss.cfg != nil && ss.cfg.UnifiedAlerting.IsEnabled()
}

func (ss *sqlStatsService) updateUserRoleCountsIfNecessary(ctx context.Context, forced bool) error {
	memoizationPeriod := time.Now().Add(-userStatsCacheLimetime)
	if forced || userStatsCache.memoized.Before(memoizationPeriod) {
		err := ss.updateUserRoleCounts(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

type memoUserStats struct {
	active      stats.UserStats
	dailyActive stats.UserStats
	total       stats.UserStats

	memoized time.Time
}

var (
	userStatsCache         = memoUserStats{}
	userStatsCacheLimetime = 5 * time.Minute
)

func (ss *sqlStatsService) updateUserRoleCounts(ctx context.Context) error {
	return ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := `
SELECT role AS bitrole, active, COUNT(role) AS count FROM
  (SELECT last_seen_at>? AS active, last_seen_at>? AS daily_active, SUM(role) AS role
   FROM (SELECT
      u.id,
      CASE org_user.role
        WHEN 'Admin' THEN 4
        WHEN 'Editor' THEN 2
        ELSE 1
      END AS role,
      u.last_seen_at
    FROM ` + ss.db.GetDialect().Quote("user") + ` AS u INNER JOIN org_user ON org_user.user_id = u.id
    GROUP BY u.id, u.last_seen_at, org_user.role) AS t2
  GROUP BY id, last_seen_at) AS t1
GROUP BY active, daily_active, role;`

		activeUserDeadline := time.Now().Add(-activeUserTimeLimit)
		dailyActiveUserDeadline := time.Now().Add(-dailyActiveUserTimeLimit)

		type rolebitmap struct {
			Active      bool
			DailyActive bool
			Bitrole     int64
			Count       int64
		}

		bitmap := []rolebitmap{}
		err := dbSession.Context(ctx).SQL(query, activeUserDeadline, dailyActiveUserDeadline).Find(&bitmap)
		if err != nil {
			return err
		}

		memo := memoUserStats{memoized: time.Now()}
		for _, role := range bitmap {
			roletype := org.RoleViewer
			if role.Bitrole&0b100 != 0 {
				roletype = org.RoleAdmin
			} else if role.Bitrole&0b10 != 0 {
				roletype = org.RoleEditor
			}

			memo.total = addToStats(memo.total, roletype, role.Count)
			if role.Active {
				memo.active = addToStats(memo.active, roletype, role.Count)
			}
			if role.DailyActive {
				memo.dailyActive = addToStats(memo.dailyActive, roletype, role.Count)
			}
		}

		userStatsCache = memo
		return nil
	})
}

func addToStats(base stats.UserStats, role org.RoleType, count int64) stats.UserStats {
	base.Users += count

	switch role {
	case org.RoleAdmin:
		base.Admins += count
	case org.RoleEditor:
		base.Editors += count
	default:
		base.Viewers += count
	}

	return base
}
