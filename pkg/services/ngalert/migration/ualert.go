package migration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	alertingNotify "github.com/grafana/alerting/notify"
	pb "github.com/prometheus/alertmanager/silence/silencepb"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
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

var migTitle = "move dashboard alerts to unified alerting"

var rmMigTitle = "remove unified alerting data"

const clearMigrationEntryTitle = "clear migration entry %q"

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

type migration struct {
	sess    *xorm.Session
	log     log.Logger
	store   db.DB
	dialect migrator.Dialect
	cfg     *setting.Cfg

	seenUIDs uidSet
	silences map[int64][]*pb.MeshSilence
}

func getSilenceFileNamesForAllOrgs(dataPath string) ([]string, error) {
	return filepath.Glob(filepath.Join(dataPath, "alerting", "*", "silences"))
}

//nolint:gocyclo
func (m *migration) Exec() error {
	dashAlerts, err := m.slurpDashAlerts()
	if err != nil {
		return err
	}
	m.log.Info("alerts found to migrate", "alerts", len(dashAlerts))

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
		sess:    m.sess,
		dialect: m.dialect,
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
		l := m.log.New("ruleID", da.Id, "ruleName", da.Name, "dashboardUID", da.DashboardUID, "orgID", da.OrgId)
		l.Debug("migrating alert rule to Unified Alerting")
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
		rule, err := m.makeAlertRule(l, *newCond, da, folder.Uid)
		if err != nil {
			return fmt.Errorf("failed to migrate alert rule '%s' [ID:%d, DashboardUID:%s, orgID:%d]: %w", da.Name, da.Id, da.DashboardUID, da.OrgId, err)
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
			m.log.Error("alert migration error: failed to write silence file", "err", err)
		}
	}

	amConfigPerOrg, err := m.setupAlertmanagerConfigs(rulesPerOrg)
	if err != nil {
		return err
	}

	err = m.insertRules(m.store, rulesPerOrg)
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

func (m *migration) insertRules(store db.DB, rulesPerOrg map[int64]map[*alertRule][]uidOrID) error {
	for _, rules := range rulesPerOrg {
		for rule := range rules {
			var err error
			if strings.HasPrefix(m.dialect.DriverName(), migrator.Postgres) {
				err = store.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
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

	// remove an existing configuration, which could have been left during switching back to legacy alerting
	_, _ = m.sess.Delete(AlertConfiguration{OrgID: orgID})

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
func (m *migration) validateAlertmanagerConfig(config *PostableUserConfig) error {
	for _, r := range config.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			data, err := gr.Settings.MarshalJSON()
			if err != nil {
				return err
			}
			var (
				cfg = &alertingNotify.GrafanaIntegrationConfig{
					UID:                   gr.UID,
					Name:                  gr.Name,
					Type:                  gr.Type,
					DisableResolveMessage: gr.DisableResolveMessage,
					Settings:              data,
					SecureSettings:        gr.SecureSettings,
				}
			)

			// decryptFunc represents the legacy way of decrypting data. Before the migration, we don't need any new way,
			// given that the previous alerting will never support it.
			decryptFunc := func(_ context.Context, sjd map[string][]byte, key string, fallback string) string {
				if value, ok := sjd[key]; ok {
					decryptedData, err := util.Decrypt(value, setting.SecretKey)
					if err != nil {
						m.log.Warn("unable to decrypt key '%s' for %s receiver with uid %s, returning fallback.", key, gr.Type, gr.UID)
						return fallback
					}
					return string(decryptedData)
				}
				return fallback
			}
			_, err = alertingNotify.BuildReceiverConfiguration(context.Background(), &alertingNotify.APIReceiver{
				GrafanaIntegrations: alertingNotify.GrafanaIntegrations{Integrations: []*alertingNotify.GrafanaIntegrationConfig{cfg}},
			}, decryptFunc)
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
