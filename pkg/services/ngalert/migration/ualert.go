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

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
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
	log     log.Logger
	dialect migrator.Dialect
	cfg     *setting.Cfg

	seenUIDs uidSet
	silences map[int64][]*pb.MeshSilence

	store             db.DB
	ruleStore         RuleStore
	alertingStore     AlertingStore
	encryptionService secrets.Service
}

func newMigration(
	log log.Logger,
	cfg *setting.Cfg,
	store db.DB,
	ruleStore RuleStore,
	alertingStore AlertingStore,
	dialect migrator.Dialect,
	encryptionService secrets.Service,
) *migration {
	return &migration{
		// We deduplicate for case-insensitive matching in MySQL-compatible backend flavours because they use case-insensitive collation.
		seenUIDs:          uidSet{set: make(map[string]struct{}), caseInsensitive: dialect.SupportEngine()},
		silences:          make(map[int64][]*pb.MeshSilence),
		log:               log,
		dialect:           dialect,
		cfg:               cfg,
		store:             store,
		ruleStore:         ruleStore,
		alertingStore:     alertingStore,
		encryptionService: encryptionService,
	}
}

func getSilenceFileNamesForAllOrgs(dataPath string) ([]string, error) {
	return filepath.Glob(filepath.Join(dataPath, "alerting", "*", "silences"))
}

//nolint:gocyclo
func (m *migration) Exec(ctx context.Context) error {
	dashAlerts, err := m.slurpDashAlerts(ctx)
	if err != nil {
		return err
	}
	m.log.Info("alerts found to migrate", "alerts", len(dashAlerts))

	// [orgID, dataSourceId] -> UID
	dsIDMap, err := m.slurpDSIDs(ctx)
	if err != nil {
		return err
	}

	// [orgID, dashboardId] -> dashUID
	dashIDMap, err := m.slurpDashUIDs(ctx)
	if err != nil {
		return err
	}

	// cache for folders created for dashboards that have custom permissions
	folderCache := make(map[string]*dashboard)
	// cache for the general folders
	generalFolderCache := make(map[int64]*dashboard)

	folderHelper := folderHelper{
		store:   m.store,
		dialect: m.dialect,
	}

	gf := func(dash dashboard, da dashAlert) (*dashboard, error) {
		f, ok := generalFolderCache[dash.OrgId]
		if !ok {
			// get or create general folder
			f, err = folderHelper.getOrCreateGeneralFolder(ctx, dash.OrgId)
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
	rulesPerOrg := make(map[int64]map[*models.AlertRule][]uidOrID)

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
		err = m.store.WithDbSession(ctx, func(sess *db.Session) error {
			exists, err := sess.Where("org_id=? AND uid=?", da.OrgId, da.DashboardUID).Get(&dash)
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
			return nil
		})
		if err != nil {
			return err
		}

		var folder *dashboard
		switch {
		case dash.HasACL:
			folderName := getAlertFolderNameFromDashboard(&dash)
			f, ok := folderCache[folderName]
			if !ok {
				l.Info("create a new folder for alerts that belongs to dashboard because it has custom permissions", "folder", folderName)
				// create folder and assign the permissions of the dashboard (included default and inherited)
				f, err = folderHelper.createFolder(ctx, dash.OrgId, folderName)
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to create folder: %w", err),
						AlertId: da.Id,
					}
				}
				permissions, err := folderHelper.getACL(ctx, dash.OrgId, dash.Id)
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to get dashboard %d under organisation %d permissions: %w", dash.Id, dash.OrgId, err),
						AlertId: da.Id,
					}
				}
				err = folderHelper.setACL(ctx, f.OrgId, f.Id, permissions)
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
			f, err := folderHelper.getFolder(ctx, dash)
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
			rulesPerOrg[rule.OrgID] = make(map[*models.AlertRule][]uidOrID)
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

	amConfigPerOrg, err := m.setupAlertmanagerConfigs(ctx, rulesPerOrg)
	if err != nil {
		return err
	}

	err = m.insertRules(ctx, rulesPerOrg)
	if err != nil {
		return err
	}

	for orgID, amConfig := range amConfigPerOrg {
		if err := m.writeAlertmanagerConfig(ctx, orgID, amConfig); err != nil {
			return err
		}
	}

	return nil
}

func (m *migration) insertRules(ctx context.Context, rulesPerOrg map[int64]map[*models.AlertRule][]uidOrID) error {
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
		_, err := m.ruleStore.InsertAlertRules(ctx, rules)
		if err != nil {
			return err
		}
	}
	return nil
}

func (m *migration) writeAlertmanagerConfig(ctx context.Context, orgID int64, amConfig *apimodels.PostableUserConfig) error {
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
	return m.alertingStore.SaveAlertmanagerConfiguration(ctx, &cmd)
}

// validateAlertmanagerConfig validates the alertmanager configuration produced by the migration against the receivers.
func (m *migration) validateAlertmanagerConfig(config *apimodels.PostableUserConfig) error {
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

			_, err = alertingNotify.BuildReceiverConfiguration(context.Background(), &alertingNotify.APIReceiver{
				GrafanaIntegrations: alertingNotify.GrafanaIntegrations{Integrations: []*alertingNotify.GrafanaIntegrationConfig{cfg}},
			}, m.encryptionService.GetDecryptedValue)
			if err != nil {
				return err
			}
		}
	}

	return nil
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
