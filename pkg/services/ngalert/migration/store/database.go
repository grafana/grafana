package store

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/matttproud/golang_protobuf_extensions/pbutil"
	pb "github.com/prometheus/alertmanager/silence/silencepb"

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
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// Store is the database abstraction for migration persistence.
type Store interface {
	ReadStore
	WriteStore
}

// ReadStore is the database abstraction for read-only migration persistence.
type ReadStore interface {
	GetAlertmanagerConfig(ctx context.Context, orgID int64) (*apimodels.PostableUserConfig, error)

	GetAllOrgs(ctx context.Context) ([]*org.OrgDTO, error)

	GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error)

	GetNotificationChannels(ctx context.Context, orgID int64) ([]*legacymodels.AlertNotification, error)
	GetNotificationChannel(ctx context.Context, q GetNotificationChannelQuery) (*legacymodels.AlertNotification, error)

	GetDashboardAlert(ctx context.Context, orgID int64, dashboardID int64, panelID int64) (*legacymodels.Alert, error)
	GetDashboardAlerts(ctx context.Context, orgID int64, dashboardID int64) ([]*legacymodels.Alert, error)
	GetOrgDashboardAlerts(ctx context.Context, orgID int64) (map[int64][]*legacymodels.Alert, int, error)

	GetDashboardPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error)
	GetFolderPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error)
	MapActions(permission accesscontrol.ResourcePermission) string

	GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error)
	GetFolder(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error)

	IsMigrated(ctx context.Context, orgID int64) (bool, error)
	GetCurrentAlertingType(ctx context.Context) (AlertingType, error)
	GetOrgMigrationState(ctx context.Context, orgID int64) (*OrgMigrationState, error)

	GetAlertRuleTitles(ctx context.Context, orgID int64, namespaceUIDs ...string) (map[string][]string, error)                 // NamespaceUID -> Titles
	GetRuleLabels(ctx context.Context, orgID int64, ruleUIDs []string) (map[models.AlertRuleKeyWithVersion]data.Labels, error) // Rule UID -> Labels

	CaseInsensitive() bool

	// Slims for performance optimization of GetOrgSummary rehydration.
	GetSlimDashboards(ctx context.Context, orgID int64) (map[int64]SlimDashboard, error)
	GetSlimOrgDashboardAlerts(ctx context.Context, orgID int64) (map[int64][]*SlimAlert, error)
	GetSlimAlertRules(ctx context.Context, orgID int64) (map[string]*SlimAlertRule, error)
}

// WriteStore is the database abstraction for write migration persistence.
type WriteStore interface {
	InsertAlertRules(ctx context.Context, rules ...models.AlertRule) error

	SaveAlertmanagerConfiguration(ctx context.Context, orgID int64, amConfig *apimodels.PostableUserConfig) error

	SetDashboardPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error)
	SetFolderPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error)

	CreateFolder(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error)

	SetMigrated(ctx context.Context, orgID int64, migrated bool) error
	SetCurrentAlertingType(ctx context.Context, t AlertingType) error
	SetOrgMigrationState(ctx context.Context, orgID int64, summary *OrgMigrationState) error

	RevertOrg(ctx context.Context, orgID int64) error
	RevertAllOrgs(ctx context.Context) error

	DeleteAlertRules(ctx context.Context, orgID int64, alertRuleUIDs ...string) error
	DeleteFolders(ctx context.Context, orgID int64, uids ...string) error

	UpdateRuleLabels(ctx context.Context, key models.AlertRuleKeyWithVersion, labels data.Labels) error

	SetSilences(ctx context.Context, orgID int64, silences []*pb.MeshSilence) error
}

type migrationStore struct {
	store                db.DB
	cfg                  *setting.Cfg
	log                  log.Logger
	kv                   kvstore.KVStore
	alertingStore        *store.DBstore
	dashboardService     dashboards.DashboardService
	folderService        folder.Service
	dataSourceCache      datasources.CacheService
	folderPermissions    accesscontrol.FolderPermissionsService
	dashboardPermissions accesscontrol.DashboardPermissionsService
	orgService           org.Service

	legacyAlertNotificationService *legacyalerting.AlertNotificationService
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
	folderPermissions accesscontrol.FolderPermissionsService,
	dashboardPermissions accesscontrol.DashboardPermissionsService,
	orgService org.Service,
	legacyAlertNotificationService *legacyalerting.AlertNotificationService,
) (Store, error) {
	return &migrationStore{
		log:                            log.New("ngalert.migration-store"),
		cfg:                            cfg,
		store:                          sqlStore,
		kv:                             kv,
		alertingStore:                  alertingStore,
		dashboardService:               dashboardService,
		folderService:                  folderService,
		dataSourceCache:                dataSourceCache,
		folderPermissions:              folderPermissions,
		dashboardPermissions:           dashboardPermissions,
		orgService:                     orgService,
		legacyAlertNotificationService: legacyAlertNotificationService,
	}, nil
}

// KVNamespace is the kvstore namespace used for the migration status.
const KVNamespace = "ngalert.migration"

// migratedKey is the kvstore key used for the migration status.
const migratedKey = "migrated"

// stateKey is the kvstore key used for the OrgMigrationState.
const stateKey = "stateKey"

// typeKey is the kvstore key used for the current AlertingType.
const typeKey = "currentAlertingType"

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

// AlertingType represents the current alerting type of Grafana. This is used to detect transitions between
// Legacy and UnifiedAlerting by comparing to the desired type in the configuration.
type AlertingType string

const (
	Legacy          AlertingType = "Legacy"
	UnifiedAlerting AlertingType = "UnifiedAlerting"
)

// typeFromString converts a string to an AlertingType.
func typeFromString(s string) (AlertingType, error) {
	switch s {
	case "Legacy":
		return Legacy, nil
	case "UnifiedAlerting":
		return UnifiedAlerting, nil
	default:
		return "", fmt.Errorf("unknown alerting type: %s", s)
	}
}

const anyOrg = 0

// GetCurrentAlertingType returns the current AlertingType of Grafana.
func (ms *migrationStore) GetCurrentAlertingType(ctx context.Context) (AlertingType, error) {
	kv := kvstore.WithNamespace(ms.kv, anyOrg, KVNamespace)
	content, exists, err := kv.Get(ctx, typeKey)
	if err != nil {
		return "", err
	}

	if !exists {
		return Legacy, nil
	}

	t, err := typeFromString(content)
	if err != nil {
		return "", err
	}

	return t, nil
}

// SetCurrentAlertingType stores the current AlertingType of Grafana.
func (ms *migrationStore) SetCurrentAlertingType(ctx context.Context, t AlertingType) error {
	kv := kvstore.WithNamespace(ms.kv, anyOrg, KVNamespace)
	return kv.Set(ctx, typeKey, string(t))
}

// GetOrgMigrationState returns the state of the previous migration.
func (ms *migrationStore) GetOrgMigrationState(ctx context.Context, orgID int64) (*OrgMigrationState, error) {
	kv := kvstore.WithNamespace(ms.kv, orgID, KVNamespace)
	content, exists, err := kv.Get(ctx, stateKey)
	if err != nil {
		return nil, err
	}

	if !exists {
		return &OrgMigrationState{
			OrgID:              orgID,
			MigratedDashboards: make(map[int64]*DashboardUpgrade),
			MigratedChannels:   make(map[int64]*ContactPair),
		}, nil
	}

	var state OrgMigrationState
	err = json.Unmarshal([]byte(content), &state)
	if err != nil {
		return nil, err
	}

	if state.MigratedChannels == nil {
		state.MigratedChannels = make(map[int64]*ContactPair)
	}

	if state.MigratedDashboards == nil {
		state.MigratedDashboards = make(map[int64]*DashboardUpgrade)
	}

	return &state, nil
}

// SetOrgMigrationState sets the summary of a previous migration.
func (ms *migrationStore) SetOrgMigrationState(ctx context.Context, orgID int64, state *OrgMigrationState) error {
	kv := kvstore.WithNamespace(ms.kv, orgID, KVNamespace)

	raw, err := json.Marshal(state)
	if err != nil {
		return err
	}

	return kv.Set(ctx, stateKey, string(raw))
}

// SetSilences stores the given silences in the kvstore.
func (ms *migrationStore) SetSilences(ctx context.Context, orgID int64, silences []*pb.MeshSilence) error {
	kv := kvstore.WithNamespace(ms.kv, orgID, notifier.KVNamespace)

	var buf bytes.Buffer
	for _, e := range silences {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return err
		}
	}

	return kv.Set(ctx, notifier.SilencesFilename, base64.StdEncoding.EncodeToString(buf.Bytes()))
}

// GetAlertRuleTitles returns a map of namespaceUID -> title for all alert rules in the given org and namespace uids.
func (ms *migrationStore) GetAlertRuleTitles(ctx context.Context, orgID int64, namespaceUIDs ...string) (map[string][]string, error) {
	res := make(map[string][]string)
	err := ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		type title struct {
			NamespaceUID string `xorm:"namespace_uid"`
			Title        string
		}
		titles := make([]title, 0)
		s := sess.Table("alert_rule").Cols("namespace_uid", "title").Where("org_id = ?", orgID)
		if len(namespaceUIDs) > 0 {
			s = s.In("namespace_uid", namespaceUIDs)
		}
		err := s.Find(&titles)
		if err != nil {
			return err
		}

		for _, t := range titles {
			if _, ok := res[t.NamespaceUID]; !ok {
				res[t.NamespaceUID] = make([]string, 0)
			}
			res[t.NamespaceUID] = append(res[t.NamespaceUID], t.Title)
		}
		return nil
	})
	return res, err
}

// GetRuleLabels returns a map of rule UID / version -> labels for all given org and rule uids. Version is needed to
// update alert rules because of their optimistic locking.
func (ms *migrationStore) GetRuleLabels(ctx context.Context, orgID int64, ruleUIDs []string) (map[models.AlertRuleKeyWithVersion]data.Labels, error) {
	res := make(map[models.AlertRuleKeyWithVersion]data.Labels, len(ruleUIDs))
	err := ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		type label struct {
			models.AlertRuleKeyWithVersion `xorm:"extends"`
			Labels                         data.Labels
		}
		labels := make([]label, 0)
		err := sess.Table("alert_rule").Cols("uid", "org_id", "version", "labels").Where("org_id = ?", orgID).In("uid", ruleUIDs).Find(&labels)
		if err != nil {
			return err
		}

		for _, l := range labels {
			res[l.AlertRuleKeyWithVersion] = l.Labels
		}
		return nil
	})
	return res, err
}

// UpdateRuleLabels updates the labels of an alert rule. Version is needed to update alert rules because of optimistic locking.
func (ms *migrationStore) UpdateRuleLabels(ctx context.Context, key models.AlertRuleKeyWithVersion, labels data.Labels) error {
	return ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		affected, err := sess.Cols("labels").Where("org_id = ? AND uid = ?", key.OrgID, key.UID).Update(&models.AlertRule{
			Version: key.Version,
			Labels:  labels,
		})

		if err != nil {
			return err
		}
		if affected == 0 {
			return fmt.Errorf("rule with uid %v not found", key)
		}
		return nil
	})
}

// BATCHSIZE is a reasonable SQL batch size to prevent hitting placeholder limits (such as Error 1390 in MySQL) or packet size limits.
const BATCHSIZE = 1000

// batchBy batches a given slice in a way as to minimize allocations, see https://github.com/golang/go/wiki/SliceTricks#batching-with-minimal-allocation.
func batchBy[T any](items []T, batchSize int) (batches [][]T) {
	for batchSize < len(items) {
		items, batches = items[batchSize:], append(batches, items[0:batchSize:batchSize])
	}
	return append(batches, items)
}

// InsertAlertRules inserts alert rules.
func (ms *migrationStore) InsertAlertRules(ctx context.Context, rules ...models.AlertRule) error {
	batches := batchBy(rules, BATCHSIZE)
	for _, batch := range batches {
		_, err := ms.alertingStore.InsertAlertRules(ctx, batch)
		if err != nil {
			return err
		}
	}
	return nil
}

// DeleteAlertRules deletes alert rules in a given org by their UIDs.
func (ms *migrationStore) DeleteAlertRules(ctx context.Context, orgID int64, alertRuleUIDs ...string) error {
	batches := batchBy(alertRuleUIDs, BATCHSIZE)
	for _, batch := range batches {
		err := ms.alertingStore.DeleteAlertRulesByUID(ctx, orgID, batch...)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetAlertmanagerConfig returns the alertmanager configuration for the given org.
func (ms *migrationStore) GetAlertmanagerConfig(ctx context.Context, orgID int64) (*apimodels.PostableUserConfig, error) {
	amConfig, err := ms.alertingStore.GetLatestAlertmanagerConfiguration(ctx, orgID)
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

// SaveAlertmanagerConfiguration saves the alertmanager configuration for the given org.
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

// RevertOrg reverts the migration for a given org, deleting all unified alerting resources such as alert rules and alertmanager
// configurations as well as all other database resources created during the migration, such as folders.
func (ms *migrationStore) RevertOrg(ctx context.Context, orgID int64) error {
	return ms.store.InTransaction(ctx, func(ctx context.Context) error {
		return ms.store.WithDbSession(ctx, func(sess *db.Session) error {
			l := ms.log.FromContext(ctx)
			if _, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ?", orgID); err != nil {
				return err
			}

			if _, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_org_id = ?", orgID); err != nil {
				return err
			}

			state, err := ms.GetOrgMigrationState(ctx, orgID)
			if err != nil {
				return err
			}
			if err := ms.DeleteFolders(ctx, orgID, state.CreatedFolders...); err != nil {
				l.Warn("Failed to delete migrated folders", "orgId", orgID, "err", err)
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
					l.Error("Failed to remove silence file", "file", f, "err", err)
				}
			}

			return nil
		})
	})
}

// RevertAllOrgs reverts the migration, deleting all unified alerting resources such as alert rules, alertmanager configurations, and silence files.
// In addition, it will delete all folders and permissions originally created by this migration, as well as the various migration statuses stored
// in kvstore, both org-specific and anyOrg.
func (ms *migrationStore) RevertAllOrgs(ctx context.Context) error {
	return ms.store.InTransaction(ctx, func(ctx context.Context) error {
		return ms.store.WithDbSession(ctx, func(sess *db.Session) error {
			l := ms.log.FromContext(ctx)
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
				state, err := ms.GetOrgMigrationState(ctx, o.ID)
				if err != nil {
					return err
				}
				if err := ms.DeleteFolders(ctx, o.ID, state.CreatedFolders...); err != nil {
					l.Warn("Failed to delete migrated folders", "orgId", o.ID, "err", err)
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
					l.Error("Failed to remove silence file", "file", f, "err", err)
				}
			}

			return nil
		})
	})
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

// GetDashboard returns a single dashboard for the given org and dashboard id.
func (ms *migrationStore) GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error) {
	return ms.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{ID: id, OrgID: orgID})
}

// GetAllOrgs returns all orgs.
func (ms *migrationStore) GetAllOrgs(ctx context.Context) ([]*org.OrgDTO, error) {
	orgQuery := &org.SearchOrgsQuery{}
	return ms.orgService.Search(ctx, orgQuery)
}

// GetDatasource returns a single datasource for the given org and datasource id.
func (ms *migrationStore) GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error) {
	return ms.dataSourceCache.GetDatasource(ctx, datasourceID, user, false)
}

// GetNotificationChannels returns all channels for this org.
func (ms *migrationStore) GetNotificationChannels(ctx context.Context, orgID int64) ([]*legacymodels.AlertNotification, error) {
	return ms.legacyAlertNotificationService.GetAllAlertNotifications(ctx, &legacymodels.GetAllAlertNotificationsQuery{
		OrgID: orgID,
	})
}

type GetNotificationChannelQuery struct {
	OrgID int64
	ID    int64
	UID   string
}

var ErrNotFound = errors.New("not found")

// GetNotificationChannel returns a single channel for this org by id or uid.
func (ms *migrationStore) GetNotificationChannel(ctx context.Context, q GetNotificationChannelQuery) (*legacymodels.AlertNotification, error) {
	if q.OrgID == 0 {
		return nil, fmt.Errorf("org id must be set")
	}
	if q.ID == 0 && q.UID == "" {
		return nil, fmt.Errorf("id or uid must be set")
	}
	var res legacymodels.AlertNotification
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		var exists bool
		var err error
		s := sess.Table("alert_notification").Where("org_id = ?", q.OrgID)
		if q.ID > 0 {
			exists, err = s.Where("id = ?", q.ID).Get(&res)
		} else if q.UID != "" {
			exists, err = s.Where("uid = ?", q.UID).Get(&res)
		}
		if err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		return nil
	})
	return &res, err
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

func (ms *migrationStore) CaseInsensitive() bool {
	return ms.store.GetDialect().SupportEngine()
}

// GetSlimDashboards returns a map of dashboard id -> SlimDashboard for all dashboards in the given org. This is used as a
// performance optimization to avoid loading the full dashboards in bulk.
func (ms *migrationStore) GetSlimDashboards(ctx context.Context, orgID int64) (map[int64]SlimDashboard, error) {
	res := make(map[int64]SlimDashboard)
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		dashes := make([]SlimDashboard, 0)
		err := sess.Table("dashboard").Alias("d").Select("d.id, d.uid, d.title, d.folder_id, dashboard_provisioning.id IS NOT NULL as provisioned").
			Join("LEFT", "dashboard_provisioning", `d.id = dashboard_provisioning.dashboard_id`).
			Where("org_id = ?", orgID).Find(&dashes)
		if err != nil {
			return err
		}
		for _, d := range dashes {
			res[d.ID] = d
		}
		res[0] = SlimDashboard{ID: 0, Title: folder.GeneralFolder.Title}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return res, nil
}

// GetSlimOrgDashboardAlerts returns a map of dashboard id -> SlimAlert for all alerts in the given org. This is used as a
// performance optimization to avoid loading the full alerts in bulk.
func (ms *migrationStore) GetSlimOrgDashboardAlerts(ctx context.Context, orgID int64) (map[int64][]*SlimAlert, error) {
	res := make(map[int64][]*SlimAlert)
	rules := make([]*SlimAlert, 0)
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table("alert").Cols("id", "dashboard_id", "panel_id", "name").Where("org_id = ?", orgID).Find(&rules)
		if err != nil {
			return err
		}

		for _, r := range rules {
			res[r.DashboardID] = append(res[r.DashboardID], r)
		}
		return nil
	})
	return res, err
}

// GetSlimAlertRules returns a map of rule UID -> SlimAlertRule for all alert rules in the given org. This is used as a
// performance optimization to avoid loading the full alert rules in bulk.
func (ms *migrationStore) GetSlimAlertRules(ctx context.Context, orgID int64) (map[string]*SlimAlertRule, error) {
	res := make(map[string]*SlimAlertRule)
	err := ms.store.WithDbSession(ctx, func(sess *db.Session) error {
		rules := make([]*SlimAlertRule, 0)
		err := sess.Table("alert_rule").Cols("uid", "title", "namespace_uid", "labels").Where("org_id = ?", orgID).Find(&rules)
		if err != nil {
			return err
		}

		for _, r := range rules {
			res[r.UID] = r
		}
		return nil
	})
	return res, err
}
