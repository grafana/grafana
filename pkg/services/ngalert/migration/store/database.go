package store

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

// Store is the database abstraction for migration persistence.
type Store interface {
	InsertAlertRules(ctx context.Context, rulesPerOrg map[int64]map[*models.AlertRule][]UidOrID) error

	SaveAlertmanagerConfiguration(ctx context.Context, orgID int64, amConfig *apimodels.PostableUserConfig) error

	GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error)

	GetNotificationChannels(ctx context.Context) (ChannelsPerOrg, DefaultChannelsPerOrg, error)

	GetDashboardAlerts(ctx context.Context) ([]DashAlert, error)

	GetACL(ctx context.Context, orgID int64, dashID int64) ([]*DashboardACL, error)
	SetACL(ctx context.Context, orgID int64, dashboardID int64, items []*DashboardACL) error

	GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error)
	GetFolder(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error)
	CreateFolder(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error)

	IsMigrated(ctx context.Context) (bool, error)
	SetMigrated(ctx context.Context, migrated bool) error

	RevertAllOrgs(ctx context.Context) error

	CaseInsensitive() bool
}

type migrationStore struct {
	store            db.DB
	cfg              *setting.Cfg
	log              log.Logger
	kv               kvstore.KVStore
	alertingStore    *store.DBstore
	dashboardService dashboards.DashboardService
	folderService    folder.Service
	dataSourceCache  datasources.CacheService
}

// MigrationStore implements the Store interface.
var _ Store = (*migrationStore)(nil)

func ProvideMigrationStore(
	cfg *setting.Cfg,
	sqlStore db.DB,
	kv kvstore.KVStore,
	alertingStore *store.DBstore,
	dashboardService dashboards.DashboardService,
	folderService folder.Service,
	dataSourceCache datasources.CacheService,
) (Store, error) {
	return &migrationStore{
		log:              log.New("ngalert.migration-store"),
		cfg:              cfg,
		store:            sqlStore,
		kv:               kv,
		alertingStore:    alertingStore,
		dashboardService: dashboardService,
		folderService:    folderService,
		dataSourceCache:  dataSourceCache,
	}, nil
}

// KVNamespace is the kvstore namespace used for the migration status.
const KVNamespace = "ngalert.migration"

// migratedKey is the kvstore key used for the migration status.
const migratedKey = "migrated"

const anyOrg = 0

// IsMigrated returns the migration status from the kvstore.
func (ms *migrationStore) IsMigrated(ctx context.Context) (bool, error) {
	kv := kvstore.WithNamespace(ms.kv, anyOrg, KVNamespace)
	content, exists, err := kv.Get(ctx, migratedKey)
	if err != nil {
		return false, err
	}

	if !exists {
		return false, nil
	}

	return strconv.ParseBool(content)
}

// SetMigrated sets the migration status in the kvstore.
func (ms *migrationStore) SetMigrated(ctx context.Context, migrated bool) error {
	kv := kvstore.WithNamespace(ms.kv, anyOrg, KVNamespace)
	return kv.Set(ctx, migratedKey, strconv.FormatBool(migrated))
}

func (ms *migrationStore) InsertAlertRules(ctx context.Context, rulesPerOrg map[int64]map[*models.AlertRule][]UidOrID) error {
	for _, orgRules := range rulesPerOrg {
		titleDedup := make(map[string]map[string]struct{}) // Namespace -> Title -> struct{}

		rules := make([]models.AlertRule, 0, len(orgRules))
		for rule := range orgRules {
			existingTitles, ok := titleDedup[rule.NamespaceUID]
			if !ok {
				existingTitles = make(map[string]struct{})
				titleDedup[rule.NamespaceUID] = existingTitles
			}
			if _, ok := existingTitles[rule.Title]; ok {
				rule.Title += fmt.Sprintf(" %v", rule.UID)
				rule.RuleGroup += fmt.Sprintf(" %v", rule.UID)
			}

			existingTitles[rule.Title] = struct{}{}
			rules = append(rules, *rule)
		}
		_, err := ms.alertingStore.InsertAlertRules(ctx, rules)
		if err != nil {
			return err
		}
	}
	return nil
}

func (ms *migrationStore) SaveAlertmanagerConfiguration(ctx context.Context, orgID int64, amConfig *apimodels.PostableUserConfig) error {
	rawAmConfig, err := json.Marshal(amConfig)
	if err != nil {
		return err
	}

	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(rawAmConfig),
		ConfigurationVersion:      fmt.Sprintf("v%d", models.AlertConfigurationVersion),
		Default:                   false,
		OrgID:                     orgID,
		LastApplied:               0,
	}
	return ms.alertingStore.SaveAlertmanagerConfiguration(ctx, &cmd)
}

// FOLDER_CREATED_BY us used to track folders created by this migration
// during alert migration cleanup.
const FOLDER_CREATED_BY = -8

// RevertAllOrgs reverts the migration, deleting all unified alerting resources such as alert rules, alertmanager configurations, and silence files.
// In addition, it will delete all folders and permissions originally created by this migration, these are stored in the kvstore.
func (ms *migrationStore) RevertAllOrgs(ctx context.Context) error {
	return ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("delete from alert_rule")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from alert_rule_version")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from dashboard_acl where dashboard_id IN (select id from dashboard where created_by = ?)", FOLDER_CREATED_BY)
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from dashboard where created_by = ?", FOLDER_CREATED_BY)
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from alert_configuration")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from ngalert_configuration")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from alert_instance")
		if err != nil {
			return err
		}

		exists, err := sess.IsTableExist("kv_store")
		if err != nil {
			return err
		}

		if exists {
			_, err = sess.Exec("delete from kv_store where namespace = ?", notifier.KVNamespace)
			if err != nil {
				return err
			}
		}

		files, err := filepath.Glob(filepath.Join(ms.cfg.DataPath, "alerting", "*", "silences"))
		if err != nil {
			return err
		}
		for _, f := range files {
			if err := os.Remove(f); err != nil {
				ms.log.Error("alert migration error: failed to remove silence file", "file", f, "err", err)
			}
		}

		err = ms.SetMigrated(ctx, false)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}

		return nil
	})
}

func (ms *migrationStore) GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error) {
	return ms.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{ID: id, OrgID: orgID})
}

func (ms *migrationStore) GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error) {
	return ms.dataSourceCache.GetDatasource(ctx, datasourceID, user, false)
}

// getNotificationChannelMap returns a map of all channelUIDs to channel config as well as a separate map for just those channels that are default.
// For any given Organization, all channels in defaultChannelsPerOrg should also exist in channelsPerOrg.
func (ms *migrationStore) GetNotificationChannels(ctx context.Context) (ChannelsPerOrg, DefaultChannelsPerOrg, error) {
	q := `
	SELECT id,
		org_id,
		uid,
		name,
		type,
		disable_resolve_message,
		is_default,
		settings,
		secure_settings,
        send_reminder,
		frequency
	FROM
		alert_notification
	`
	allChannels := []legacymodels.AlertNotification{}
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(q).Find(&allChannels)
	})
	if err != nil {
		return nil, nil, err
	}

	if len(allChannels) == 0 {
		return nil, nil, nil
	}

	allChannelsMap := make(ChannelsPerOrg)
	defaultChannelsMap := make(DefaultChannelsPerOrg)
	for i, c := range allChannels {
		if c.Type == "hipchat" || c.Type == "sensu" {
			ms.log.Error("Alert migration error: discontinued notification channel found", "type", c.Type, "name", c.Name, "uid", c.UID)
			continue
		}

		allChannelsMap[c.OrgID] = append(allChannelsMap[c.OrgID], &allChannels[i])

		if c.IsDefault {
			defaultChannelsMap[c.OrgID] = append(defaultChannelsMap[c.OrgID], &allChannels[i])
		}
	}

	return allChannelsMap, defaultChannelsMap, nil
}

func (ms *migrationStore) GetFolder(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error) {
	return ms.folderService.Get(ctx, cmd)
}

func (ms *migrationStore) CreateFolder(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	return ms.folderService.Create(ctx, cmd)
}

// based on SQLStore.GetDashboardACLInfoList()
func (ms *migrationStore) GetACL(ctx context.Context, orgID, dashboardID int64) ([]*DashboardACL, error) {
	var err error

	falseStr := ms.store.GetDialect().BooleanStr(false)

	result := make([]*DashboardACL, 0)
	rawSQL := `
			-- get distinct permissions for the dashboard and its parent folder
			SELECT DISTINCT
				da.id,
				da.user_id,
				da.team_id,
				da.permission,
				da.role
			FROM dashboard as d
				LEFT JOIN dashboard folder on folder.id = d.folder_id
				LEFT JOIN dashboard_acl AS da ON
				da.dashboard_id = d.id OR
				da.dashboard_id = d.folder_id  OR
				(
					-- include default permissions --
					da.org_id = -1 AND (
					  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					)
				)
			WHERE d.org_id = ? AND d.id = ? AND da.id IS NOT NULL
			ORDER BY da.id ASC
			`
	err = ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(rawSQL, orgID, dashboardID).Find(&result)
	})
	if err != nil {
		return nil, err
	}
	return result, err
}

// based on SQLStore.UpdateDashboardACL()
// it should be called from inside a transaction
func (ms *migrationStore) SetACL(ctx context.Context, orgID int64, dashboardID int64, items []*DashboardACL) error {
	if dashboardID <= 0 {
		return fmt.Errorf("folder id must be greater than zero for a folder permission")
	}
	return ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		// userPermissionsMap is a map keeping the highest permission per user
		// for handling conficting inherited (folder) and non-inherited (dashboard) user permissions
		userPermissionsMap := make(map[int64]*DashboardACL, len(items))
		// teamPermissionsMap is a map keeping the highest permission per team
		// for handling conficting inherited (folder) and non-inherited (dashboard) team permissions
		teamPermissionsMap := make(map[int64]*DashboardACL, len(items))
		for _, item := range items {
			if item.UserID != 0 {
				acl, ok := userPermissionsMap[item.UserID]
				if !ok {
					userPermissionsMap[item.UserID] = item
				} else {
					if item.Permission > acl.Permission {
						// the higher permission wins
						userPermissionsMap[item.UserID] = item
					}
				}
			}

			if item.TeamID != 0 {
				acl, ok := teamPermissionsMap[item.TeamID]
				if !ok {
					teamPermissionsMap[item.TeamID] = item
				} else {
					if item.Permission > acl.Permission {
						// the higher permission wins
						teamPermissionsMap[item.TeamID] = item
					}
				}
			}
		}

		type keyType struct {
			UserID     int64 `xorm:"user_id"`
			TeamID     int64 `xorm:"team_id"`
			Role       RoleType
			Permission permissionType
		}
		// seen keeps track of inserted perrmissions to avoid duplicates (due to inheritance)
		seen := make(map[keyType]struct{}, len(items))
		for _, item := range items {
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return dashboards.ErrDashboardACLInfoMissing
			}

			// ignore duplicate user permissions
			if item.UserID != 0 {
				acl, ok := userPermissionsMap[item.UserID]
				if ok {
					if acl.Id != item.Id {
						continue
					}
				}
			}

			// ignore duplicate team permissions
			if item.TeamID != 0 {
				acl, ok := teamPermissionsMap[item.TeamID]
				if ok {
					if acl.Id != item.Id {
						continue
					}
				}
			}

			key := keyType{UserID: item.UserID, TeamID: item.TeamID, Role: "", Permission: item.Permission}
			if item.Role != nil {
				key.Role = *item.Role
			}
			if _, ok := seen[key]; ok {
				continue
			}

			// unset Id so that the new record will get a different one
			item.Id = 0
			item.OrgID = orgID
			item.DashboardID = dashboardID
			item.Created = time.Now()
			item.Updated = time.Now()

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
			seen[key] = struct{}{}
		}

		// Update dashboard HasACL flag
		dashboard := dashboards.Dashboard{HasACL: true}
		_, err := sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)

		return err
	})
}

var slurpDashSQL = `
SELECT *
FROM
	alert
WHERE org_id IN (SELECT id from org)
	AND dashboard_id IN (SELECT id from dashboard)
`

// GetDashboardAlerts loads all alerts from the alert database table into
// the dashAlert type. If there are alerts that belong to either organization or dashboard that does not exist, those alerts will not be returned/
// Additionally it unmarshals the json settings for the alert into the
// ParsedSettings property of the dash alert.
func (ms *migrationStore) GetDashboardAlerts(ctx context.Context) ([]DashAlert, error) {
	var dashAlerts []DashAlert
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		var alerts []legacymodels.Alert
		err := sess.SQL(slurpDashSQL).Find(&alerts)
		if err != nil {
			return err
		}

		dashAlerts = make([]DashAlert, 0, len(alerts))
		for i := range alerts {
			alert := alerts[i]

			rawSettings, err := json.Marshal(alert.Settings)
			if err != nil {
				return fmt.Errorf("get settings for alert rule ID:%d, name:'%s', orgID:%d: %w", alert.ID, alert.Name, alert.OrgID, err)
			}
			var parsedSettings DashAlertSettings
			err = json.Unmarshal(rawSettings, &parsedSettings)
			if err != nil {
				return fmt.Errorf("parse settings for alert rule ID:%d, name:'%s', orgID:%d: %w", alert.ID, alert.Name, alert.OrgID, err)
			}

			dashAlerts = append(dashAlerts, DashAlert{
				Alert:          &alerts[i],
				ParsedSettings: &parsedSettings,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return dashAlerts, nil
}

func (ms *migrationStore) CaseInsensitive() bool {
	return ms.store.GetDialect().SupportEngine()
}
