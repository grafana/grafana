package ualert

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	pb "github.com/prometheus/alertmanager/silence/silencepb"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const GENERAL_FOLDER = "General Alerting"
const DASHBOARD_FOLDER = "Migrated %s"

// FOLDER_CREATED_BY us used to track folders created by this migration
// during alert migration cleanup.
const FOLDER_CREATED_BY = -8

const KV_NAMESPACE = "alertmanager"

var migTitle = "move dashboard alerts to unified alerting"

var rmMigTitle = "remove unified alerting data"

const clearMigrationEntryTitle = "clear migration entry %q"

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
		mg.Logger.Crit("alert migration failure: could not get migration log", "error", err)
		os.Exit(1)
	}

	_, migrationRun := logs[migTitle]

	switch {
	case mg.Cfg.UnifiedAlerting.Enabled && !migrationRun:
		// Remove the migration entry that removes all unified alerting data. This is so when the feature
		// flag is removed in future the "remove unified alerting data" migration will be run again.
		mg.AddMigration(fmt.Sprintf(clearMigrationEntryTitle, rmMigTitle), &clearMigrationEntry{
			migrationID: rmMigTitle,
		})
		if err != nil {
			mg.Logger.Error("alert migration error: could not clear alert migration for removing data", "error", err)
		}
		mg.AddMigration(migTitle, &migration{
			seenChannelUIDs:           make(map[string]struct{}),
			migratedChannelsPerOrg:    make(map[int64]map[*notificationChannel]struct{}),
			portedChannelGroupsPerOrg: make(map[int64]map[string]string),
			silences:                  make(map[int64][]*pb.MeshSilence),
		})
	case !mg.Cfg.UnifiedAlerting.Enabled && migrationRun:
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
		mg.Logger.Crit("alert migration failure: could not get migration log", "error", err)
		os.Exit(1)
	}

	cloneMigTitle := fmt.Sprintf("clone %s", migTitle)

	_, migrationRun := logs[cloneMigTitle]
	ngEnabled := mg.Cfg.UnifiedAlerting.Enabled

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
		mg.Logger.Crit("alert migration failure: could not get migration log", "error", err)
		os.Exit(1)
	}

	migrationID := "update dashboard_uid and panel_id from existing annotations"
	_, migrationRun := logs[migrationID]
	ngEnabled := mg.Cfg.UnifiedAlerting.Enabled
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
		if s, ok := next.Annotations["__dashboardUid__"]; ok {
			dashboardUID = &s
		}
		if s, ok := next.Annotations["__panelId__"]; ok {
			i, err := strconv.ParseInt(s, 10, 64)
			if err != nil {
				return fmt.Errorf("the __panelId__ annotation does not contain a valid Panel ID: %w", err)
			}
			panelID = &i
		}
		if _, err := sess.Exec(`UPDATE alert_rule SET dashboard_uid = ?, panel_id = ? WHERE id = ?`,
			dashboardUID,
			panelID,
			next.ID); err != nil {
			return fmt.Errorf("failed to set dashboard_uid and panel_id for alert rule: %w", err)
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

	seenChannelUIDs           map[string]struct{}
	migratedChannelsPerOrg    map[int64]map[*notificationChannel]struct{}
	silences                  map[int64][]*pb.MeshSilence
	portedChannelGroupsPerOrg map[int64]map[string]string // Org -> Channel group key -> receiver name.
	lastReceiverID            int                         // For the auto generated receivers.
}

func (m *migration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *migration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	m.sess = sess
	m.mg = mg

	dashAlerts, err := m.slurpDashAlerts()
	if err != nil {
		return err
	}

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

	// allChannels: channelUID -> channelConfig
	allChannelsPerOrg, defaultChannelsPerOrg, err := m.getNotificationChannelMap()
	if err != nil {
		return err
	}

	amConfigPerOrg := make(amConfigsPerOrg, len(allChannelsPerOrg))
	err = m.addDefaultChannels(amConfigPerOrg, allChannelsPerOrg, defaultChannelsPerOrg)
	if err != nil {
		return err
	}

	for _, da := range dashAlerts {
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

		// get folder if exists
		folder, err := m.getFolder(dash, da)
		if err != nil {
			return MigrationError{
				Err:     err,
				AlertId: da.Id,
			}
		}

		switch {
		case dash.HasAcl:
			// create folder and assign the permissions of the dashboard (included default and inherited)
			ptr, err := m.createFolder(dash.OrgId, fmt.Sprintf(DASHBOARD_FOLDER, getMigrationString(da)))
			if err != nil {
				return MigrationError{
					Err:     fmt.Errorf("failed to create folder: %w", err),
					AlertId: da.Id,
				}
			}
			folder = *ptr
			permissions, err := m.getACL(dash.OrgId, dash.Id)
			if err != nil {
				return MigrationError{
					Err:     fmt.Errorf("failed to get dashboard %d under organisation %d permissions: %w", dash.Id, dash.OrgId, err),
					AlertId: da.Id,
				}
			}
			err = m.setACL(folder.OrgId, folder.Id, permissions)
			if err != nil {
				return MigrationError{
					Err:     fmt.Errorf("failed to set folder %d under organisation %d permissions: %w", folder.Id, folder.OrgId, err),
					AlertId: da.Id,
				}
			}
		case dash.FolderId > 0:
			// link the new rule to the existing folder
		default:
			// get or create general folder
			ptr, err := m.getOrCreateGeneralFolder(dash.OrgId)
			if err != nil {
				return MigrationError{
					Err:     fmt.Errorf("failed to get or create general folder under organisation %d: %w", dash.OrgId, err),
					AlertId: da.Id,
				}
			}
			// No need to assign default permissions to general folder
			// because they are included to the query result if it's a folder with no permissions
			// https://github.com/grafana/grafana/blob/076e2ce06a6ecf15804423fcc8dca1b620a321e5/pkg/services/sqlstore/dashboard_acl.go#L109
			folder = *ptr
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

		if _, ok := amConfigPerOrg[rule.OrgID]; !ok {
			m.mg.Logger.Info("no configuration found", "org", rule.OrgID)
		} else {
			if err := m.updateReceiverAndRoute(allChannelsPerOrg, defaultChannelsPerOrg, da, rule, amConfigPerOrg[rule.OrgID]); err != nil {
				return err
			}
		}

		if strings.HasPrefix(mg.Dialect.DriverName(), migrator.Postgres) {
			err = mg.InTransaction(func(sess *xorm.Session) error {
				_, err = sess.Insert(rule)
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

	for orgID, amConfig := range amConfigPerOrg {
		// Create a separate receiver for all the unmigrated channels.
		err = m.addUnmigratedChannels(orgID, amConfig, allChannelsPerOrg[orgID], defaultChannelsPerOrg[orgID])
		if err != nil {
			return err
		}

		if err := m.writeAlertmanagerConfig(orgID, amConfig, allChannelsPerOrg[orgID]); err != nil {
			return err
		}

		if err := m.writeSilencesFile(orgID); err != nil {
			m.mg.Logger.Error("alert migration error: failed to write silence file", "err", err)
		}
	}

	return nil
}

func (m *migration) writeAlertmanagerConfig(orgID int64, amConfig *PostableUserConfig, allChannels map[interface{}]*notificationChannel) error {
	if len(allChannels) == 0 {
		// No channels, hence don't require Alertmanager config.
		m.mg.Logger.Info("alert migration: no notification channel found, skipping Alertmanager config")
		return nil
	}

	if err := amConfig.EncryptSecureSettings(); err != nil {
		return err
	}
	rawAmConfig, err := json.Marshal(amConfig)
	if err != nil {
		return err
	}

	// TODO: should we apply the config here? Because Alertmanager can take upto 1 min to pick it up.
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
	return "code migration"
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
	return "code migration"
}
