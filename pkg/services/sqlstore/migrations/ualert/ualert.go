package ualert

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	alertingLogging "github.com/grafana/alerting/logging"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers"
	pb "github.com/prometheus/alertmanager/silence/silencepb"
	"xorm.io/xorm"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const GENERAL_FOLDER = "General Alerting"
const DASHBOARD_FOLDER = "%s Alerts - %s"

// MaxFolderName is the maximum length of the folder name generated using DASHBOARD_FOLDER format
const MaxFolderName = 255

// FOLDER_CREATED_BY us used to track folders created by this migration
// during alert migration cleanup.
const FOLDER_CREATED_BY = -8

const KV_NAMESPACE = "alertmanager"

var migTitle = "move dashboard alerts to unified alerting"

var rmMigTitle = "remove unified alerting data"

const clearMigrationEntryTitle = "clear migration entry %q"
const codeMigration = "code migration"

// It is defined in pkg/expr/service.go as "DatasourceType"
const expressionDatasourceUID = "__expr__"

type MigrationError struct {
	AlertId int64
	Err     error
}

func (e MigrationError) Error() string {
	return fmt.Sprintf("failed to migrate alert %d: %s", e.AlertId, e.Err.Error())
}

func (e *MigrationError) Unwrap() error { return e.Err }

func AddDashAlertMigration(mg *migrator.Migrator) {
	logs, err := mg.GetMigrationLog()
	if err != nil {
		mg.Logger.Error("alert migration failure: could not get migration log", "error", err)
		os.Exit(1)
	}

	_, migrationRun := logs[migTitle]

	switch {
	// If unified alerting is enabled and the upgrade migration has not been run
	case mg.Cfg.UnifiedAlerting.IsEnabled() && !migrationRun:
		// Remove the migration entry that removes all unified alerting data. This is so when the feature
		// flag is removed in future the "remove unified alerting data" migration will be run again.
		mg.AddMigration(fmt.Sprintf(clearMigrationEntryTitle, rmMigTitle), &clearMigrationEntry{
			migrationID: rmMigTitle,
		})
		if err != nil {
			mg.Logger.Error("alert migration error: could not clear alert migration for removing data", "error", err)
		}
		mg.AddMigration(migTitle, &migration{
			// We deduplicate for case-insensitive matching in MySQL-compatible backend flavours because they use case-insensitive collation.
			seenUIDs: uidSet{set: make(map[string]struct{}), caseInsensitive: mg.Dialect.SupportEngine()},
			silences: make(map[int64][]*pb.MeshSilence),
		})
	// If unified alerting is disabled and upgrade migration has been run
	case !mg.Cfg.UnifiedAlerting.IsEnabled() && migrationRun:
		// If legacy alerting is also disabled, there is nothing to do
		if setting.AlertingEnabled != nil && !*setting.AlertingEnabled {
			return
		}

		// Safeguard to prevent data loss when migrating from UA to LA
		if !mg.Cfg.ForceMigration {
			panic("Grafana has already been migrated to Unified Alerting.\nAny alert rules created while using Unified Alerting will be deleted by rolling back.\n\nSet force_migration=true in your grafana.ini and restart Grafana to roll back and delete Unified Alerting configuration data.")
		}
		// Remove the migration entry that creates unified alerting data. This is so when the feature
		// flag is enabled in the future the migration "move dashboard alerts to unified alerting" will be run again.
		mg.AddMigration(fmt.Sprintf(clearMigrationEntryTitle, migTitle), &clearMigrationEntry{
			migrationID: migTitle,
		})
		if err != nil {
			mg.Logger.Error("alert migration error: could not clear dashboard alert migration", "error", err)
		}
		mg.AddMigration(rmMigTitle, &rmMigration{})
	}
}

// RerunDashAlertMigration force the dashboard alert migration to run
// to make sure that the Alertmanager configurations will be created for each organisation
func RerunDashAlertMigration(mg *migrator.Migrator) {
	logs, err := mg.GetMigrationLog()
	if err != nil {
		mg.Logger.Error("alert migration failure: could not get migration log", "error", err)
		os.Exit(1)
	}

	cloneMigTitle := fmt.Sprintf("clone %s", migTitle)

	_, migrationRun := logs[cloneMigTitle]
	ngEnabled := mg.Cfg.UnifiedAlerting.IsEnabled()

	switch {
	case ngEnabled && !migrationRun:
		// The only use of this migration is when a user enabled ng-alerting before 8.2.
		mg.AddMigration(cloneMigTitle, &upgradeNgAlerting{})
		// if user disables the feature flag and enables it back.
		// This migration does not need to be run because the original migration AddDashAlertMigration does what's needed
	}
}

func AddDashboardUIDPanelIDMigration(mg *migrator.Migrator) {
	logs, err := mg.GetMigrationLog()
	if err != nil {
		mg.Logger.Error("alert migration failure: could not get migration log", "error", err)
		os.Exit(1)
	}

	migrationID := "update dashboard_uid and panel_id from existing annotations"
	_, migrationRun := logs[migrationID]
	ngEnabled := mg.Cfg.UnifiedAlerting.IsEnabled()
	undoMigrationID := "undo " + migrationID

	if ngEnabled && !migrationRun {
		// If ngalert is enabled and the migration has not been run then run it.
		mg.AddMigration(migrationID, &updateDashboardUIDPanelIDMigration{})
	} else if !ngEnabled && migrationRun {
		// If ngalert is disabled and the migration has been run then remove it
		// from the migration log so it will run if ngalert is re-enabled.
		mg.AddMigration(undoMigrationID, &clearMigrationEntry{
			migrationID: migrationID,
		})
	}
}

// updateDashboardUIDPanelIDMigration sets the dashboard_uid and panel_id columns
// from the __dashboardUid__ and __panelId__ annotations.
type updateDashboardUIDPanelIDMigration struct {
	migrator.MigrationBase
}

func (m *updateDashboardUIDPanelIDMigration) SQL(_ migrator.Dialect) string {
	return "set dashboard_uid and panel_id migration"
}

func (m *updateDashboardUIDPanelIDMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var results []struct {
		ID          int64             `xorm:"id"`
		Annotations map[string]string `xorm:"annotations"`
	}
	if err := sess.SQL(`SELECT id, annotations FROM alert_rule`).Find(&results); err != nil {
		return fmt.Errorf("failed to get annotations for all alert rules: %w", err)
	}
	for _, next := range results {
		var (
			dashboardUID *string
			panelID      *int64
		)
		if s, ok := next.Annotations[ngmodels.DashboardUIDAnnotation]; ok {
			dashboardUID = &s
		}
		if s, ok := next.Annotations[ngmodels.PanelIDAnnotation]; ok {
			i, err := strconv.ParseInt(s, 10, 64)
			if err != nil {
				return fmt.Errorf("the %s annotation does not contain a valid Panel ID: %w", ngmodels.PanelIDAnnotation, err)
			}
			panelID = &i
		}
		// We do not want to set panel_id to a non-nil value when dashboard_uid is nil
		// as panel_id is not unique and so cannot be queried without its dashboard_uid.
		// This can happen where users have deleted the dashboard_uid annotation but kept
		// the panel_id annotation.
		if dashboardUID != nil {
			if _, err := sess.Exec(`UPDATE alert_rule SET dashboard_uid = ?, panel_id = ? WHERE id = ?`,
				dashboardUID,
				panelID,
				next.ID); err != nil {
				return fmt.Errorf("failed to set dashboard_uid and panel_id for alert rule: %w", err)
			}
		}
	}
	return nil
}

// clearMigrationEntry removes an entry fromt the migration_log table.
// This migration is not recorded in the migration_log so that it can re-run several times.
type clearMigrationEntry struct {
	migrator.MigrationBase

	migrationID string
}

func (m *clearMigrationEntry) SQL(dialect migrator.Dialect) string {
	return "clear migration entry code migration"
}

func (m *clearMigrationEntry) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	_, err := sess.SQL(`DELETE from migration_log where migration_id = ?`, m.migrationID).Query()
	if err != nil {
		return fmt.Errorf("failed to clear migration entry %v: %w", m.migrationID, err)
	}
	return nil
}

func (m *clearMigrationEntry) SkipMigrationLog() bool {
	return true
}

type migration struct {
	migrator.MigrationBase
	// session and mg are attached for convenience.
	sess *xorm.Session
	mg   *migrator.Migrator

	seenUIDs uidSet
	silences map[int64][]*pb.MeshSilence
}

func (m *migration) SQL(dialect migrator.Dialect) string {
	return codeMigration
}

//nolint:gocyclo
func (m *migration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	m.sess = sess
	m.mg = mg

	dashAlerts, err := m.slurpDashAlerts()
	if err != nil {
		return err
	}
	mg.Logger.Info("alerts found to migrate", "alerts", len(dashAlerts))

	// [orgID, dataSourceId] -> UID
	dsIDMap, err := m.slurpDSIDs()
	if err != nil {
		return err
	}

	// [orgID, dashboardId] -> dashUID
	dashIDMap, err := m.slurpDashUIDs()
	if err != nil {
		return err
	}

	// cache for folders created for dashboards that have custom permissions
	folderCache := make(map[string]*dashboard)
	// cache for the general folders
	generalFolderCache := make(map[int64]*dashboard)

	folderHelper := folderHelper{
		sess: sess,
		mg:   mg,
	}

	gf := func(dash dashboard, da dashAlert) (*dashboard, error) {
		f, ok := generalFolderCache[dash.OrgId]
		if !ok {
			// get or create general folder
			f, err = folderHelper.getOrCreateGeneralFolder(dash.OrgId)
			if err != nil {
				return nil, MigrationError{
					Err:     fmt.Errorf("failed to get or create general folder under organisation %d: %w", dash.OrgId, err),
					AlertId: da.Id,
				}
			}
			generalFolderCache[dash.OrgId] = f
		}
		// No need to assign default permissions to general folder
		// because they are included to the query result if it's a folder with no permissions
		// https://github.com/grafana/grafana/blob/076e2ce06a6ecf15804423fcc8dca1b620a321e5/pkg/services/sqlstore/dashboard_acl.go#L109
		return f, nil
	}

	// Per org map of newly created rules to which notification channels it should send to.
	rulesPerOrg := make(map[int64]map[*alertRule][]uidOrID)

	for _, da := range dashAlerts {
		l := mg.Logger.New("ruleID", da.Id, "ruleName", da.Name, "dashboardUID", da.DashboardUID, "orgID", da.OrgId)
		newCond, err := transConditions(*da.ParsedSettings, da.OrgId, dsIDMap)
		if err != nil {
			return err
		}

		da.DashboardUID = dashIDMap[[2]int64{da.OrgId, da.DashboardId}]

		// get dashboard
		dash := dashboard{}
		exists, err := m.sess.Where("org_id=? AND uid=?", da.OrgId, da.DashboardUID).Get(&dash)
		if err != nil {
			return MigrationError{
				Err:     fmt.Errorf("failed to get dashboard %s under organisation %d: %w", da.DashboardUID, da.OrgId, err),
				AlertId: da.Id,
			}
		}
		if !exists {
			return MigrationError{
				Err:     fmt.Errorf("dashboard with UID %v under organisation %d not found: %w", da.DashboardUID, da.OrgId, err),
				AlertId: da.Id,
			}
		}

		var folder *dashboard
		switch {
		case dash.HasACL:
			folderName := getAlertFolderNameFromDashboard(&dash)
			f, ok := folderCache[folderName]
			if !ok {
				l.Info("create a new folder for alerts that belongs to dashboard because it has custom permissions", "folder", folderName)
				// create folder and assign the permissions of the dashboard (included default and inherited)
				f, err = folderHelper.createFolder(dash.OrgId, folderName)
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to create folder: %w", err),
						AlertId: da.Id,
					}
				}
				permissions, err := folderHelper.getACL(dash.OrgId, dash.Id)
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to get dashboard %d under organisation %d permissions: %w", dash.Id, dash.OrgId, err),
						AlertId: da.Id,
					}
				}
				err = folderHelper.setACL(f.OrgId, f.Id, permissions)
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to set folder %d under organisation %d permissions: %w", f.Id, f.OrgId, err),
						AlertId: da.Id,
					}
				}
				folderCache[folderName] = f
			}
			folder = f
		case dash.FolderId > 0:
			// get folder if exists
			f, err := folderHelper.getFolder(dash, da)
			if err != nil {
				// If folder does not exist then the dashboard is an orphan and we migrate the alert to the general folder.
				l.Warn("Failed to find folder for dashboard. Migrate rule to the default folder", "rule_name", da.Name, "dashboard_uid", da.DashboardUID, "missing_folder_id", dash.FolderId)
				folder, err = gf(dash, da)
				if err != nil {
					return err
				}
			} else {
				folder = &f
			}
		default:
			folder, err = gf(dash, da)
			if err != nil {
				return err
			}
		}

		if folder.Uid == "" {
			return MigrationError{
				Err:     fmt.Errorf("empty folder identifier"),
				AlertId: da.Id,
			}
		}
		rule, err := m.makeAlertRule(*newCond, da, folder.Uid)
		if err != nil {
			return err
		}

		if _, ok := rulesPerOrg[rule.OrgID]; !ok {
			rulesPerOrg[rule.OrgID] = make(map[*alertRule][]uidOrID)
		}
		if _, ok := rulesPerOrg[rule.OrgID][rule]; !ok {
			rulesPerOrg[rule.OrgID][rule] = extractChannelIDs(da)
		} else {
			return MigrationError{
				Err:     fmt.Errorf("duplicate generated rule UID"),
				AlertId: da.Id,
			}
		}
	}

	for orgID := range rulesPerOrg {
		if err := m.writeSilencesFile(orgID); err != nil {
			m.mg.Logger.Error("alert migration error: failed to write silence file", "err", err)
		}
	}

	amConfigPerOrg, err := m.setupAlertmanagerConfigs(rulesPerOrg)
	if err != nil {
		return err
	}

	err = m.insertRules(mg, rulesPerOrg)
	if err != nil {
		return err
	}

	for orgID, amConfig := range amConfigPerOrg {
		if err := m.writeAlertmanagerConfig(orgID, amConfig); err != nil {
			return err
		}
	}

	return nil
}

func (m *migration) insertRules(mg *migrator.Migrator, rulesPerOrg map[int64]map[*alertRule][]uidOrID) error {
	for _, rules := range rulesPerOrg {
		for rule := range rules {
			var err error
			if strings.HasPrefix(mg.Dialect.DriverName(), migrator.Postgres) {
				err = mg.InTransaction(func(sess *xorm.Session) error {
					_, err := sess.Insert(rule)
					return err
				})
			} else {
				_, err = m.sess.Insert(rule)
			}
			if err != nil {
				// TODO better error handling, if constraint
				rule.Title += fmt.Sprintf(" %v", rule.UID)
				rule.RuleGroup += fmt.Sprintf(" %v", rule.UID)

				_, err = m.sess.Insert(rule)
				if err != nil {
					return err
				}
			}

			// create entry in alert_rule_version
			_, err = m.sess.Insert(rule.makeVersion())
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *migration) writeAlertmanagerConfig(orgID int64, amConfig *PostableUserConfig) error {
	rawAmConfig, err := json.Marshal(amConfig)
	if err != nil {
		return err
	}

	// We don't need to apply the configuration, given the multi org alertmanager will do an initial sync before the server is ready.
	_, err = m.sess.Insert(AlertConfiguration{
		AlertmanagerConfiguration: string(rawAmConfig),
		// Since we are migration for a snapshot of the code, it is always going to migrate to
		// the v1 config.
		ConfigurationVersion: "v1",
		OrgID:                orgID,
	})
	if err != nil {
		return err
	}

	return nil
}

// validateAlertmanagerConfig validates the alertmanager configuration produced by the migration against the receivers.
func (m *migration) validateAlertmanagerConfig(orgID int64, config *PostableUserConfig) error {
	for _, r := range config.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			// First, let's decode the secure settings - given they're stored as base64.
			secureSettings := make(map[string][]byte, len(gr.SecureSettings))
			for k, v := range gr.SecureSettings {
				d, err := base64.StdEncoding.DecodeString(v)
				if err != nil {
					return err
				}
				secureSettings[k] = d
			}

			data, err := gr.Settings.MarshalJSON()
			if err != nil {
				return err
			}
			var (
				cfg = &receivers.NotificationChannelConfig{
					UID:                   gr.UID,
					OrgID:                 orgID,
					Name:                  gr.Name,
					Type:                  gr.Type,
					DisableResolveMessage: gr.DisableResolveMessage,
					Settings:              data,
					SecureSettings:        secureSettings,
				}
			)

			// decryptFunc represents the legacy way of decrypting data. Before the migration, we don't need any new way,
			// given that the previous alerting will never support it.
			decryptFunc := func(_ context.Context, sjd map[string][]byte, key string, fallback string) string {
				if value, ok := sjd[key]; ok {
					decryptedData, err := util.Decrypt(value, setting.SecretKey)
					if err != nil {
						m.mg.Logger.Warn("unable to decrypt key '%s' for %s receiver with uid %s, returning fallback.", key, gr.Type, gr.UID)
						return fallback
					}
					return string(decryptedData)
				}
				return fallback
			}
			receiverFactory, exists := alertingNotify.Factory(gr.Type)
			if !exists {
				return fmt.Errorf("notifier %s is not supported", gr.Type)
			}
			factoryConfig, err := receivers.NewFactoryConfig(cfg, nil, decryptFunc, nil, nil, func(ctx ...interface{}) alertingLogging.Logger {
				return &alertingLogging.FakeLogger{}
			}, setting.BuildVersion)
			if err != nil {
				return err
			}
			_, err = receiverFactory(factoryConfig)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

type AlertConfiguration struct {
	ID    int64 `xorm:"pk autoincr 'id'"`
	OrgID int64 `xorm:"org_id"`

	AlertmanagerConfiguration string
	ConfigurationVersion      string
	CreatedAt                 int64 `xorm:"created"`
}

// rmMigration removes Grafana 8 alert data
type rmMigration struct {
	migrator.MigrationBase
}

func (m *rmMigration) SQL(dialect migrator.Dialect) string {
	return codeMigration
}

func (m *rmMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
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
		_, err = sess.Exec("delete from kv_store where namespace = ?", KV_NAMESPACE)
		if err != nil {
			return err
		}
	}

	files, err := getSilenceFileNamesForAllOrgs(mg)
	if err != nil {
		return err
	}
	for _, f := range files {
		if err := os.Remove(f); err != nil {
			mg.Logger.Error("alert migration error: failed to remove silence file", "file", f, "err", err)
		}
	}

	return nil
}

// rmMigrationWithoutLogging is similar migration to rmMigration
// but is not recorded in the migration_log table so that it can rerun in the future
type rmMigrationWithoutLogging = rmMigration

func (m *rmMigrationWithoutLogging) SkipMigrationLog() bool {
	return true
}

type upgradeNgAlerting struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = &upgradeNgAlerting{}

func (u *upgradeNgAlerting) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	firstOrgId, err := u.updateAlertConfigurations(sess, migrator)
	if err != nil {
		return err
	}
	u.updateAlertmanagerFiles(firstOrgId, migrator)
	return nil
}

func (u *upgradeNgAlerting) updateAlertConfigurations(sess *xorm.Session, migrator *migrator.Migrator) (int64, error) {
	// if there are records with org_id == 0 then the feature flag was enabled before 8.2 that introduced org separation.
	// if feature is enabled in 8.2 the migration "AddDashAlertMigration", which is effectively different from what was run in 8.1.x and earlier versions,
	// will handle organizations correctly, and, therefore, nothing needs to be fixed
	count, err := sess.Table(&AlertConfiguration{}).Where("org_id = 0").Count()
	if err != nil {
		return 0, fmt.Errorf("failed to query table alert_configuration: %w", err)
	}
	if count == 0 {
		return 0, nil // NOTHING TO DO
	}

	orgs := make([]int64, 0)
	// get all org IDs sorted in ascending order
	if err = sess.Table("org").OrderBy("id").Cols("id").Find(&orgs); err != nil {
		return 0, fmt.Errorf("failed to query table org: %w", err)
	}
	if len(orgs) == 0 { // should not really happen
		migrator.Logger.Info("No organizations are found. Nothing to migrate")
		return 0, nil
	}

	firstOrg := orgs[0]

	// assigning all configurations to the first org because 0 does not usually point to any
	migrator.Logger.Info("Assigning all existing records from alert_configuration to the first organization", "org", firstOrg)
	_, err = sess.Cols("org_id").Where("org_id = 0").Update(&AlertConfiguration{OrgID: firstOrg})
	if err != nil {
		return 0, fmt.Errorf("failed to update org_id for all rows in the table alert_configuration: %w", err)
	}

	// if there is a single organization it is safe to assume that all configurations belong to it.
	if len(orgs) == 1 {
		return firstOrg, nil
	}
	// if there are many organizations we cannot safely assume what organization an alert_configuration belongs to.
	// Therefore, we apply the default configuration to all organizations. The previous version could be restored if needed.
	migrator.Logger.Warn("Detected many organizations. The current alertmanager configuration will be replaced by the default one")
	configs := make([]*AlertConfiguration, 0, len(orgs))
	for _, org := range orgs {
		configs = append(configs, &AlertConfiguration{
			AlertmanagerConfiguration: migrator.Cfg.UnifiedAlerting.DefaultConfiguration,
			// Since we are migration for a snapshot of the code, it is always going to migrate to
			// the v1 config.
			ConfigurationVersion: "v1",
			OrgID:                org,
		})
	}

	_, err = sess.InsertMulti(configs)
	if err != nil {
		return 0, fmt.Errorf("failed to add default alertmanager configurations to every organization: %w", err)
	}
	return 0, nil
}

// updateAlertmanagerFiles scans the existing alerting directory '<data_dir>/alerting' for known files.
// If argument 'orgId' is not 0 updateAlertmanagerFiles moves all known files to the directory <data_dir>/alerting/<orgId>.
// Otherwise, it deletes those files.
// pre-8.2 version put all configuration files into the root of alerting directory. Since 8.2 configuration files are put in organization specific directory
func (u *upgradeNgAlerting) updateAlertmanagerFiles(orgId int64, migrator *migrator.Migrator) {
	knownFiles := map[string]interface{}{"__default__.tmpl": nil, "silences": nil, "notifications": nil}
	alertingDir := filepath.Join(migrator.Cfg.DataPath, "alerting")

	// do not fail if something goes wrong because these files are not used anymore. the worst that can happen is that we leave some leftovers behind
	deleteFile := func(fileName string) {
		path := filepath.Join(alertingDir, fileName)
		migrator.Logger.Info("Deleting alerting configuration file", "file", fileName)
		err := os.Remove(path)
		if err != nil {
			migrator.Logger.Warn("Failed to delete file", "file", path, "error", err)
		}
	}

	moveFile := func(fileName string) {
		alertingOrgDir := filepath.Join(alertingDir, strconv.FormatInt(orgId, 10))
		if err := os.MkdirAll(alertingOrgDir, 0750); err != nil {
			migrator.Logger.Error("Failed to create alerting directory for organization. Skip moving the file and delete it instead", "target_dir", alertingOrgDir, "org_id", orgId, "error", err, "file", fileName)
			deleteFile(fileName)
			return
		}
		err := os.Rename(filepath.Join(alertingDir, fileName), filepath.Join(alertingOrgDir, fileName))
		if err != nil {
			migrator.Logger.Error("Failed to move alertmanager configuration file to organization.", "source_dir", alertingDir, "target_dir", alertingOrgDir, "org_id", orgId, "error", err, "file", fileName)
			deleteFile(fileName)
		}
	}

	entries, err := os.ReadDir(alertingDir)
	if err != nil {
		if !os.IsNotExist(err) {
			keys := make([]string, 0, len(knownFiles))
			for key := range knownFiles {
				keys = append(keys, key)
			}
			migrator.Logger.Warn("Failed to clean up alerting directory. There may be files that are not used anymore.", "path", alertingDir, "files_to_delete", keys, "error", err)
		}
	}

	for _, entry := range entries {
		_, known := knownFiles[entry.Name()]
		if known {
			if orgId == 0 {
				deleteFile(entry.Name())
			} else {
				moveFile(entry.Name())
			}
		}
	}
}

func (u *upgradeNgAlerting) SQL(migrator.Dialect) string {
	return codeMigration
}

// getAlertFolderNameFromDashboard generates a folder name for alerts that belong to a dashboard. Formats the string according to DASHBOARD_FOLDER format.
// If the resulting string exceeds the migrations.MaxTitleLength, the dashboard title is stripped to be at the maximum length
func getAlertFolderNameFromDashboard(dash *dashboard) string {
	maxLen := MaxFolderName - len(fmt.Sprintf(DASHBOARD_FOLDER, "", dash.Uid))
	title := dash.Title
	if len(title) > maxLen {
		title = title[:maxLen]
	}
	return fmt.Sprintf(DASHBOARD_FOLDER, title, dash.Uid) // include UID to the name to avoid collision
}

// CreateDefaultFoldersForAlertingMigration creates a folder dedicated for alerting if no folders exist
func CreateDefaultFoldersForAlertingMigration(mg *migrator.Migrator) {
	if !mg.Cfg.UnifiedAlerting.IsEnabled() {
		return
	}
	mg.AddMigration("create default alerting folders", &createDefaultFoldersForAlertingMigration{})
}

type createDefaultFoldersForAlertingMigration struct {
	migrator.MigrationBase
}

func (c createDefaultFoldersForAlertingMigration) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	helper := folderHelper{
		sess: sess,
		mg:   migrator,
	}

	var rows []struct {
		Id   int64
		Name string
	}

	if err := sess.Table("org").Cols("id", "name").Find(&rows); err != nil {
		return fmt.Errorf("failed to read the list of organizations: %w", err)
	}

	orgsWithFolders, err := helper.getOrgsIDThatHaveFolders()
	if err != nil {
		return fmt.Errorf("failed to list organizations that have at least one folder: %w", err)
	}

	for _, row := range rows {
		// if there's at least one folder in the org or if alerting is disabled for that org, skip adding the default folder
		if _, ok := orgsWithFolders[row.Id]; ok {
			migrator.Logger.Debug("Skip adding default alerting folder because organization already has at least one folder", "org_id", row.Id)
			continue
		}
		if _, ok := migrator.Cfg.UnifiedAlerting.DisabledOrgs[row.Id]; ok {
			migrator.Logger.Debug("Skip adding default alerting folder because alerting is disabled for the organization ", "org_id", row.Id)
			continue
		}
		folder, err := helper.createGeneralFolder(row.Id)
		if err != nil {
			return fmt.Errorf("failed to create the default alerting folder for organization %s (ID: %d): %w", row.Name, row.Id, err)
		}
		migrator.Logger.Info("created the default folder for alerting", "org_id", row.Id, "folder_name", folder.Title, "folder_uid", folder.Uid)
	}
	return nil
}

func (c createDefaultFoldersForAlertingMigration) SQL(migrator.Dialect) string {
	return codeMigration
}

// UpdateRuleGroupIndexMigration updates a new field rule_group_index for alert rules that belong to a group with more than 1 alert.
func UpdateRuleGroupIndexMigration(mg *migrator.Migrator) {
	if !mg.Cfg.UnifiedAlerting.IsEnabled() {
		return
	}
	mg.AddMigration("update group index for alert rules", &updateRulesOrderInGroup{})
}

type updateRulesOrderInGroup struct {
	migrator.MigrationBase
}

func (c updateRulesOrderInGroup) SQL(migrator.Dialect) string {
	return codeMigration
}

func (c updateRulesOrderInGroup) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	var rows []*alertRule
	if err := sess.Table(alertRule{}).Asc("id").Find(&rows); err != nil {
		return fmt.Errorf("failed to read the list of alert rules: %w", err)
	}

	if len(rows) == 0 {
		migrator.Logger.Debug("No rules to migrate.")
		return nil
	}

	groups := map[ngmodels.AlertRuleGroupKey][]*alertRule{}

	for _, row := range rows {
		groupKey := ngmodels.AlertRuleGroupKey{
			OrgID:        row.OrgID,
			NamespaceUID: row.NamespaceUID,
			RuleGroup:    row.RuleGroup,
		}
		groups[groupKey] = append(groups[groupKey], row)
	}

	toUpdate := make([]*alertRule, 0, len(rows))

	for _, rules := range groups {
		for i, rule := range rules {
			if rule.RuleGroupIndex == i+1 {
				continue
			}
			rule.RuleGroupIndex = i + 1
			toUpdate = append(toUpdate, rule)
		}
	}

	if len(toUpdate) == 0 {
		migrator.Logger.Debug("No rules to upgrade group index")
		return nil
	}

	updated := time.Now()
	versions := make([]interface{}, 0, len(toUpdate))

	for _, rule := range toUpdate {
		rule.Updated = updated
		version := rule.makeVersion()
		version.Version = rule.Version + 1
		version.ParentVersion = rule.Version
		rule.Version++
		_, err := sess.ID(rule.ID).Cols("version", "updated", "rule_group_idx").Update(rule)
		if err != nil {
			migrator.Logger.Error("failed to update alert rule", "uid", rule.UID, "err", err)
			return fmt.Errorf("unable to update alert rules with group index: %w", err)
		}
		migrator.Logger.Debug("updated group index for alert rule", "rule_uid", rule.UID)
		versions = append(versions, version)
	}
	_, err := sess.Insert(versions...)
	if err != nil {
		migrator.Logger.Error("failed to insert changes to alert_rule_version", "err", err)
		return fmt.Errorf("unable to update alert rules with group index: %w", err)
	}
	return nil
}

// uidSet is a wrapper around map[string]struct{} and util.GenerateShortUID() which aims help generate uids in quick
// succession while taking into consideration case sensitivity requirements. if caseInsensitive is true, all generated
// uids must also be unique when compared in a case-insensitive manner.
type uidSet struct {
	set             map[string]struct{}
	caseInsensitive bool
}

// contains checks whether the given uid has already been generated in this uidSet.
func (s *uidSet) contains(uid string) bool {
	dedup := uid
	if s.caseInsensitive {
		dedup = strings.ToLower(dedup)
	}
	_, seen := s.set[dedup]
	return seen
}

// add adds the given uid to the uidSet.
func (s *uidSet) add(uid string) {
	dedup := uid
	if s.caseInsensitive {
		dedup = strings.ToLower(dedup)
	}
	s.set[dedup] = struct{}{}
}

// generateUid will generate a new unique uid that is not already contained in the uidSet.
// If it fails to create one that has not already been generated it will make multiple, but not unlimited, attempts.
// If all attempts are exhausted an error will be returned.
func (s *uidSet) generateUid() (string, error) {
	for i := 0; i < 5; i++ {
		gen := util.GenerateShortUID()
		if !s.contains(gen) {
			s.add(gen)
			return gen, nil
		}
	}

	return "", errors.New("failed to generate UID")
}
