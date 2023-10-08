package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	legacyalerting "github.com/grafana/grafana/pkg/services/alerting"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// Store is the database abstraction for migration persistence.
type Store interface {
	InsertAlertRules(ctx context.Context, rules ...models.AlertRule) error

	GetAlertmanagerConfig(ctx context.Context, orgID int64) (*apimodels.PostableUserConfig, error)
	SaveAlertmanagerConfiguration(ctx context.Context, orgID int64, amConfig *apimodels.PostableUserConfig) error

	GetAllOrgs(ctx context.Context) ([]*org.OrgDTO, error)

	GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error)

	GetAlertNotificationUidWithId(ctx context.Context, orgID int64, id int64) (string, error)
	GetNotificationChannels(ctx context.Context, orgID int64) ([]*legacymodels.AlertNotification, error)
	GetNotificationChannel(ctx context.Context, orgID int64, id int64) (*legacymodels.AlertNotification, error)

	GetDashboardAlert(ctx context.Context, orgID int64, dashboardID int64, panelID int64) (*legacymodels.Alert, error)
	GetDashboardAlerts(ctx context.Context, orgID int64, dashboardID int64) ([]*legacymodels.Alert, error)
	GetOrgDashboardAlerts(ctx context.Context, orgID int64) (map[int64][]*legacymodels.Alert, int, error)

	GetDashboardPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error)
	GetFolderPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error)
	SetDashboardPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error)
	SetFolderPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error)
	MapActions(permission accesscontrol.ResourcePermission) string

	GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error)
	GetFolder(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error)
	CreateFolder(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error)

	IsProvisioned(ctx context.Context, orgID int64, dashboardUID string) (bool, error)

	IsMigrated(ctx context.Context, orgID int64) (bool, error)
	SetMigrated(ctx context.Context, orgID int64, migrated bool) error
	GetOrgMigrationState(ctx context.Context, orgID int64) (*migmodels.OrgMigrationState, error)
	SetOrgMigrationState(ctx context.Context, orgID int64, summary *migmodels.OrgMigrationState) error

	RevertOrg(ctx context.Context, orgID int64) error
	RevertAllOrgs(ctx context.Context) error

	DeleteAlertRules(ctx context.Context, orgID int64, alertRuleUIDs ...string) error
	DeleteFolders(ctx context.Context, orgID int64, uids ...string) error
	DeleteMigratedFolders(ctx context.Context, orgID int64) error

	CaseInsensitive() bool
}

type migrationStore struct {
	store                db.DB
	cfg                  *setting.Cfg
	log                  log.Logger
	kv                   kvstore.KVStore
	alertingStore        *store.DBstore
	encryptionService    secrets.Service
	dashboardService     dashboards.DashboardService
	folderService        folder.Service
	dataSourceCache      datasources.CacheService
	folderPermissions    accesscontrol.FolderPermissionsService
	dashboardPermissions accesscontrol.DashboardPermissionsService
	orgService           org.Service

	legacyAlertStore               legacyalerting.AlertStore
	legacyAlertNotificationService *legacyalerting.AlertNotificationService
	dashboardProvisioningService   dashboards.DashboardProvisioningService
}

// MigrationStore implements the Store interface.
var _ Store = (*migrationStore)(nil)

func ProvideMigrationStore(
	cfg *setting.Cfg,
	sqlStore db.DB,
	kv kvstore.KVStore,
	alertingStore *store.DBstore,
	encryptionService secrets.Service,
	dashboardService dashboards.DashboardService,
	folderService folder.Service,
	dataSourceCache datasources.CacheService,
	folderPermissions accesscontrol.FolderPermissionsService,
	dashboardPermissions accesscontrol.DashboardPermissionsService,
	orgService org.Service,
	legacyAlertStore legacyalerting.AlertStore,
	legacyAlertNotificationService *legacyalerting.AlertNotificationService,
	dashboardProvisioningService dashboards.DashboardProvisioningService,
) (Store, error) {
	return &migrationStore{
		log:                            log.New("ngalert.migration-store"),
		cfg:                            cfg,
		store:                          sqlStore,
		kv:                             kv,
		alertingStore:                  alertingStore,
		encryptionService:              encryptionService,
		dashboardService:               dashboardService,
		folderService:                  folderService,
		dataSourceCache:                dataSourceCache,
		folderPermissions:              folderPermissions,
		dashboardPermissions:           dashboardPermissions,
		orgService:                     orgService,
		legacyAlertStore:               legacyAlertStore,
		legacyAlertNotificationService: legacyAlertNotificationService,
		dashboardProvisioningService:   dashboardProvisioningService,
	}, nil
}

// KVNamespace is the kvstore namespace used for the migration status.
const KVNamespace = "ngalert.migration"

// migratedKey is the kvstore key used for the migration status.
const migratedKey = "migrated"

// stateKey is the kvstore key used for the OrgMigrationState.
const stateKey = "stateKey"

// IsMigrated returns the migration status from the kvstore.
func (ms *migrationStore) IsMigrated(ctx context.Context, orgID int64) (bool, error) {
	kv := kvstore.WithNamespace(ms.kv, orgID, KVNamespace)
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
func (ms *migrationStore) SetMigrated(ctx context.Context, orgID int64, migrated bool) error {
	kv := kvstore.WithNamespace(ms.kv, orgID, KVNamespace)
	return kv.Set(ctx, migratedKey, strconv.FormatBool(migrated))
}

// GetOrgMigrationState returns a summary of a previous migration.
func (ms *migrationStore) GetOrgMigrationState(ctx context.Context, orgID int64) (*migmodels.OrgMigrationState, error) {
	kv := kvstore.WithNamespace(ms.kv, orgID, KVNamespace)
	content, exists, err := kv.Get(ctx, stateKey)
	if err != nil {
		return nil, err
	}

	if !exists {
		return &migmodels.OrgMigrationState{OrgID: orgID}, nil
	}

	var summary migmodels.OrgMigrationState
	err = json.Unmarshal([]byte(content), &summary)
	if err != nil {
		return nil, err
	}

	return &summary, nil
}

// SetOrgMigrationState sets the summary of a previous migration.
func (ms *migrationStore) SetOrgMigrationState(ctx context.Context, orgID int64, summary *migmodels.OrgMigrationState) error {
	kv := kvstore.WithNamespace(ms.kv, orgID, KVNamespace)
	raw, err := json.Marshal(summary)
	if err != nil {
		return err
	}

	return kv.Set(ctx, stateKey, string(raw))
}

func (ms *migrationStore) InsertAlertRules(ctx context.Context, rules ...models.AlertRule) error {
	if ms.store.GetDialect().DriverName() == migrator.Postgres {
		// Postgresql which will automatically rollback the whole transaction on constraint violation.
		// So, for postgresql, insertions will execute in a subtransaction.
		err := ms.store.InTransaction(ctx, func(subCtx context.Context) error {
			_, err := ms.alertingStore.InsertAlertRules(subCtx, rules)
			if err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			return err
		}
	} else {
		_, err := ms.alertingStore.InsertAlertRules(ctx, rules)
		if err != nil {
			return err
		}
	}

	return nil
}

// DeleteAlertRules deletes alert rules in a given org by their UIDs.
func (ms *migrationStore) DeleteAlertRules(ctx context.Context, orgID int64, alertRuleUIDs ...string) error {
	return ms.alertingStore.DeleteAlertRulesByUID(ctx, orgID, alertRuleUIDs...)
}

func (ms *migrationStore) GetAlertmanagerConfig(ctx context.Context, orgID int64) (*apimodels.PostableUserConfig, error) {
	query := models.GetLatestAlertmanagerConfigurationQuery{OrgID: orgID}
	amConfig, err := ms.alertingStore.GetLatestAlertmanagerConfiguration(ctx, &query)
	if err != nil && !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return nil, err
	}
	if amConfig == nil {
		return nil, nil
	}

	cfg, err := notifier.Load([]byte(amConfig.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}
	return cfg, nil
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

// revertPermissions are the permissions required for the background user to revert the migration.
var revertPermissions = []accesscontrol.Permission{
	{Action: dashboards.ActionFoldersDelete, Scope: dashboards.ScopeFoldersAll},
	{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
}

func (ms *migrationStore) RevertOrg(ctx context.Context, orgID int64) error {
	return ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ?", orgID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_org_id = ?", orgID); err != nil {
			return err
		}

		if err := ms.DeleteMigratedFolders(ctx, orgID); err != nil {
			ms.log.Warn("Failed to delete migrated folders", "orgID", orgID, "err", err)
		}

		if _, err := sess.Exec("DELETE FROM alert_configuration WHERE org_id = ?", orgID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM ngalert_configuration WHERE org_id = ?", orgID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ?", orgID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM provenance_type WHERE org_id = ?", orgID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM kv_store WHERE namespace = ? AND org_id = ?", notifier.KVNamespace, orgID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM kv_store WHERE namespace = ? AND org_id = ?", KVNamespace, orgID); err != nil {
			return err
		}

		files, err := filepath.Glob(filepath.Join(ms.cfg.DataPath, "alerting", strconv.FormatInt(orgID, 10), "silences"))
		if err != nil {
			return err
		}
		for _, f := range files {
			if err := os.Remove(f); err != nil {
				ms.log.Error("Failed to remove silence file", "file", f, "err", err)
			}
		}

		return nil
	})
}

func (ms *migrationStore) RevertAllOrgs(ctx context.Context) error {
	return ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Exec("DELETE FROM alert_rule"); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule_version"); err != nil {
			return err
		}

		orgs, err := ms.GetAllOrgs(ctx)
		if err != nil {
			return fmt.Errorf("get orgs: %w", err)
		}
		for _, o := range orgs {
			if err := ms.DeleteMigratedFolders(ctx, o.ID); err != nil {
				ms.log.Warn("Failed to delete migrated folders", "orgID", o.ID, "err", err)
				continue
			}
		}

		if _, err := sess.Exec("DELETE FROM alert_configuration"); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM ngalert_configuration"); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_instance"); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM provenance_type"); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM kv_store WHERE namespace = ?", notifier.KVNamespace); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM kv_store WHERE namespace = ?", KVNamespace); err != nil {
			return err
		}

		files, err := filepath.Glob(filepath.Join(ms.cfg.DataPath, "alerting", "*", "silences"))
		if err != nil {
			return err
		}
		for _, f := range files {
			if err := os.Remove(f); err != nil {
				ms.log.Error("Failed to remove silence file", "file", f, "err", err)
			}
		}

		return nil
	})
}

// DeleteMigratedFolders deletes all folders created by the previous migration run for the given org. This includes all folder permissions.
// If the folder is not empty of all descendants the operation will fail and return an error.
func (ms *migrationStore) DeleteMigratedFolders(ctx context.Context, orgID int64) error {
	summary, err := ms.GetOrgMigrationState(ctx, orgID)
	if err != nil {
		return err
	}
	return ms.DeleteFolders(ctx, orgID, summary.CreatedFolders...)
}

var ErrFolderNotDeleted = fmt.Errorf("folder not deleted")

// DeleteFolders deletes the folders from the given orgs with the given UIDs. This includes all folder permissions.
// If the folder is not empty of all descendants the operation will fail and return an error.
func (ms *migrationStore) DeleteFolders(ctx context.Context, orgID int64, uids ...string) error {
	if len(uids) == 0 {
		return nil
	}

	var errs error
	usr := accesscontrol.BackgroundUser("ngalert_migration_revert", orgID, org.RoleAdmin, revertPermissions)
	for _, folderUID := range uids {
		// Check if folder is empty. If not, we should not delete it.
		uid := folderUID
		countCmd := folder.GetDescendantCountsQuery{
			UID:          &uid,
			OrgID:        orgID,
			SignedInUser: usr.(*user.SignedInUser),
		}
		count, err := ms.folderService.GetDescendantCounts(ctx, &countCmd)
		if err != nil {
			errs = errors.Join(errs, fmt.Errorf("folder %s: %w", folderUID, err))
			continue
		}
		var descendantCounts []string
		var cntErr error
		for kind, cnt := range count {
			if cnt > 0 {
				descendantCounts = append(descendantCounts, fmt.Sprintf("%d %s", cnt, kind))
				if err != nil {
					cntErr = errors.Join(cntErr, err)
					continue
				}
			}
		}
		if cntErr != nil {
			errs = errors.Join(errs, fmt.Errorf("folder %s: %w", folderUID, cntErr))
			continue
		}

		if len(descendantCounts) > 0 {
			errs = errors.Join(errs, fmt.Errorf("folder %s contains descendants: %s", folderUID, strings.Join(descendantCounts, ", ")))
			continue
		}

		cmd := folder.DeleteFolderCommand{
			UID:          uid,
			OrgID:        orgID,
			SignedInUser: usr.(*user.SignedInUser),
		}
		err = ms.folderService.Delete(ctx, &cmd) // Also handles permissions and other related entities.
		if err != nil {
			errs = errors.Join(errs, fmt.Errorf("folder %s: %w", folderUID, err))
			continue
		}
	}
	if errs != nil {
		return fmt.Errorf("%w: %w", ErrFolderNotDeleted, errs)
	}
	return nil
}

func (ms *migrationStore) GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error) {
	return ms.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{ID: id, OrgID: orgID})
}

func (ms *migrationStore) GetAllOrgs(ctx context.Context) ([]*org.OrgDTO, error) {
	orgQuery := &org.SearchOrgsQuery{}
	return ms.orgService.Search(ctx, orgQuery)
}

func (ms *migrationStore) GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error) {
	return ms.dataSourceCache.GetDatasource(ctx, datasourceID, user, false)
}

func (ms *migrationStore) GetAlertNotificationUidWithId(ctx context.Context, orgID int64, id int64) (string, error) {
	cmd := legacymodels.GetAlertNotificationUidQuery{
		ID:    id,
		OrgID: orgID,
	}
	return ms.legacyAlertStore.GetAlertNotificationUidWithId(ctx, &cmd)
}

// GetNotificationChannels returns all channels for this org.
func (ms *migrationStore) GetNotificationChannels(ctx context.Context, orgID int64) ([]*legacymodels.AlertNotification, error) {
	return ms.legacyAlertNotificationService.GetAllAlertNotifications(ctx, &legacymodels.GetAllAlertNotificationsQuery{
		OrgID: orgID,
	})
}

var ErrNotFound = errors.New("not found")

// GetNotificationChannel returns a single channel for this org by id.
func (ms *migrationStore) GetNotificationChannel(ctx context.Context, orgID int64, id int64) (*legacymodels.AlertNotification, error) {
	channel, err := ms.legacyAlertNotificationService.GetAlertNotifications(ctx, &legacymodels.GetAlertNotificationsQuery{
		OrgID: orgID,
		ID:    id,
	})
	if err != nil {
		return nil, err
	}
	if channel == nil {
		// GetAlertNotifications returns nil and no error if the channel is not found.
		return nil, ErrNotFound
	}

	return channel, nil
}

// GetDashboardAlert loads a single legacy dashboard alerts for the given org and alert id.
func (ms *migrationStore) GetDashboardAlert(ctx context.Context, orgID int64, dashboardID int64, panelID int64) (*legacymodels.Alert, error) {
	var dashAlert legacymodels.Alert
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.SQL("select * from alert WHERE org_id = ? AND dashboard_id = ? AND panel_id = ?", orgID, dashboardID, panelID).Get(&dashAlert)
		if err != nil {
			return err
		}
		if !has {
			return ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &dashAlert, nil
}

// GetDashboardAlerts loads all legacy dashboard alerts for the given org and dashboard.
func (ms *migrationStore) GetDashboardAlerts(ctx context.Context, orgID int64, dashboardID int64) ([]*legacymodels.Alert, error) {
	var dashAlerts []*legacymodels.Alert
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL("select * from alert WHERE org_id = ? AND dashboard_id = ?", orgID, dashboardID).Find(&dashAlerts)
	})
	if err != nil {
		return nil, err
	}

	return dashAlerts, nil
}

// GetOrgDashboardAlerts loads all legacy dashboard alerts for the given org mapped by dashboard id.
func (ms *migrationStore) GetOrgDashboardAlerts(ctx context.Context, orgID int64) (map[int64][]*legacymodels.Alert, int, error) {
	var dashAlerts []*legacymodels.Alert
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL("select * from alert WHERE org_id = ?", orgID).Find(&dashAlerts)
	})
	if err != nil {
		return nil, 0, err
	}

	mappedAlerts := make(map[int64][]*legacymodels.Alert)
	for _, alert := range dashAlerts {
		mappedAlerts[alert.DashboardID] = append(mappedAlerts[alert.DashboardID], alert)
	}
	return mappedAlerts, len(dashAlerts), nil
}

func (ms *migrationStore) GetDashboardPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return ms.dashboardPermissions.GetPermissions(ctx, user, resourceID)
}

func (ms *migrationStore) GetFolderPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return ms.folderPermissions.GetPermissions(ctx, user, resourceID)
}

func (ms *migrationStore) GetFolder(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error) {
	return ms.folderService.Get(ctx, cmd)
}

func (ms *migrationStore) CreateFolder(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	return ms.folderService.Create(ctx, cmd)
}

func (ms *migrationStore) SetDashboardPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	return ms.dashboardPermissions.SetPermissions(ctx, orgID, resourceID, commands...)
}

func (ms *migrationStore) SetFolderPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	return ms.folderPermissions.SetPermissions(ctx, orgID, resourceID, commands...)
}

func (ms *migrationStore) MapActions(permission accesscontrol.ResourcePermission) string {
	return ms.dashboardPermissions.MapActions(permission)
}

func (ms *migrationStore) IsProvisioned(ctx context.Context, orgID int64, dashboardUID string) (bool, error) {
	info, err := ms.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardUID(ctx, orgID, dashboardUID)
	if err != nil {
		if errors.Is(err, dashboards.ErrProvisionedDashboardNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("get provisioned status: %w", err)
	}

	return info != nil, nil
}

func (ms *migrationStore) CaseInsensitive() bool {
	return ms.store.GetDialect().SupportEngine()
}
