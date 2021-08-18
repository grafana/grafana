package ualert

import (
	"encoding/json"
	"fmt"
	"os"
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

	ngEnabled := mg.Cfg.IsNgAlertEnabled()

	switch {
	case ngEnabled && !migrationRun:
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
		})
	case !ngEnabled && migrationRun:
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
	cloneRmMigTitle := fmt.Sprintf("clone %s", rmMigTitle)

	_, migrationRun := logs[cloneMigTitle]

	ngEnabled := mg.Cfg.IsNgAlertEnabled()

	switch {
	case ngEnabled && !migrationRun:
		// Removes all unified alerting data.  It is not recorded so when the feature
		// flag is removed in future the "clone remove unified alerting data" migration will be run again.
		mg.AddMigration(cloneRmMigTitle, &rmMigrationWithoutLogging{})

		mg.AddMigration(cloneMigTitle, &migration{
			seenChannelUIDs:           make(map[string]struct{}),
			migratedChannelsPerOrg:    make(map[int64]map[*notificationChannel]struct{}),
			portedChannelGroupsPerOrg: make(map[int64]map[string]string),
		})

	case !ngEnabled && migrationRun:
		// Remove the migration entry that creates unified alerting data. This is so when the feature
		// flag is enabled in the future the migration "move dashboard alerts to unified alerting" will be run again.
		mg.AddMigration(fmt.Sprintf(clearMigrationEntryTitle, cloneMigTitle), &clearMigrationEntry{
			migrationID: cloneMigTitle,
		})
		if err != nil {
			mg.Logger.Error("alert migration error: could not clear clone dashboard alert migration", "error", err)
		}
		// Removes all unified alerting data. It is not recorded so when the feature
		// flag is enabled in future the "clone remove unified alerting data" migration will be run again.
		mg.AddMigration(cloneRmMigTitle, &rmMigrationWithoutLogging{})
	}
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
	silences                  []*pb.MeshSilence
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

	_, err = sess.Exec("delete from alert_instance")
	if err != nil {
		return err
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
