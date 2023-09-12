package migration

import (
	"context"
	"errors"
	"fmt"
	"strings"

	alertingNotify "github.com/grafana/alerting/notify"
	pb "github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const DASHBOARD_FOLDER = "%s Alerts - %s"

// MaxFolderName is the maximum length of the folder name generated using DASHBOARD_FOLDER format
const MaxFolderName = 255

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
	log log.Logger
	cfg *setting.Cfg

	seenUIDs uidSet
	silences map[int64][]*pb.MeshSilence

	migrationStore    migrationStore.Store
	encryptionService secrets.Service
}

func newMigration(
	log log.Logger,
	cfg *setting.Cfg,
	migrationStore migrationStore.Store,
	encryptionService secrets.Service,
) *migration {
	return &migration{
		// We deduplicate for case-insensitive matching in MySQL-compatible backend flavours because they use case-insensitive collation.
		seenUIDs:          uidSet{set: make(map[string]struct{}), caseInsensitive: migrationStore.CaseInsensitive()},
		silences:          make(map[int64][]*pb.MeshSilence),
		log:               log,
		cfg:               cfg,
		migrationStore:    migrationStore,
		encryptionService: encryptionService,
	}
}

//nolint:gocyclo
func (m *migration) Exec(ctx context.Context) error {
	dashAlerts, err := m.migrationStore.GetDashboardAlerts(ctx)
	if err != nil {
		return err
	}
	m.log.Info("alerts found to migrate", "alerts", len(dashAlerts))

	// cache for folders created for dashboards that have custom permissions
	folderCache := make(map[string]*folder.Folder)
	// cache for the general folders
	generalFolderCache := make(map[int64]*folder.Folder)

	gf := func(dash *dashboards.Dashboard, da migrationStore.DashAlert) (*folder.Folder, error) {
		f, ok := generalFolderCache[dash.OrgID]
		if !ok {
			// get or create general folder
			f, err = m.getOrCreateGeneralFolder(ctx, dash.OrgID)
			if err != nil {
				return nil, MigrationError{
					Err:     fmt.Errorf("failed to get or create general folder under organisation %d: %w", dash.OrgID, err),
					AlertId: da.ID,
				}
			}
			generalFolderCache[dash.OrgID] = f
		}
		// No need to assign default permissions to general folder
		// because they are included to the query result if it's a folder with no permissions
		// https://github.com/grafana/grafana/blob/076e2ce06a6ecf15804423fcc8dca1b620a321e5/pkg/services/sqlstore/dashboard_acl.go#L109
		return f, nil
	}

	// Per org map of newly created rules to which notification channels it should send to.
	rulesPerOrg := make(map[int64]map[*models.AlertRule][]migrationStore.UidOrID)

	for _, da := range dashAlerts {
		l := m.log.New("ruleID", da.ID, "ruleName", da.Name, "dashboardID", da.DashboardID, "orgID", da.OrgID)
		l.Debug("migrating alert rule to Unified Alerting")
		newCond, err := transConditions(ctx, *da.ParsedSettings, da.OrgID, m.migrationStore)
		if err != nil {
			return err
		}

		dash, err := m.migrationStore.GetDashboard(ctx, da.OrgID, da.DashboardID)
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return MigrationError{
					Err:     fmt.Errorf("dashboard with ID %v under organisation %d not found: %w", da.DashboardID, da.OrgID, err),
					AlertId: da.ID,
				}
			}
			return MigrationError{
				Err:     fmt.Errorf("failed to get dashboard with ID %v under organisation %d: %w", da.DashboardID, da.OrgID, err),
				AlertId: da.ID,
			}
		}

		var migratedFolder *folder.Folder
		switch {
		case dash.HasACL:
			folderName := getAlertFolderNameFromDashboard(dash)
			f, ok := folderCache[folderName]
			if !ok {
				l.Info("create a new folder for alerts that belongs to dashboard because it has custom permissions", "folder", folderName)
				// create folder and assign the permissions of the dashboard (included default and inherited)
				f, err = m.migrationStore.CreateFolder(ctx, &folder.CreateFolderCommand{OrgID: da.OrgID, Title: folderName, SignedInUser: getBackgroundUser(da.OrgID)})
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to create folder: %w", err),
						AlertId: da.ID,
					}
				}
				permissions, err := m.migrationStore.GetACL(ctx, dash.OrgID, dash.ID)
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to get dashboard %d under organisation %d permissions: %w", dash.ID, dash.OrgID, err),
						AlertId: da.ID,
					}
				}
				err = m.migrationStore.SetACL(ctx, f.OrgID, f.ID, permissions)
				if err != nil {
					return MigrationError{
						Err:     fmt.Errorf("failed to set folder %d under organisation %d permissions: %w", f.ID, f.OrgID, err),
						AlertId: da.ID,
					}
				}
				folderCache[folderName] = f
			}
			migratedFolder = f
		case dash.FolderID > 0:
			// get folder if exists
			f, err := m.migrationStore.GetFolder(ctx, &folder.GetFolderQuery{ID: &dash.FolderID, OrgID: dash.OrgID, SignedInUser: getBackgroundUser(dash.OrgID)})
			if err != nil {
				// If folder does not exist then the dashboard is an orphan and we migrate the alert to the general folder.
				l.Warn("Failed to find folder for dashboard. Migrate rule to the default folder", "rule_name", da.Name, "dashboard_uid", dash.UID, "missing_folder_id", dash.FolderID, "error", err)
				migratedFolder, err = gf(dash, da)
				if err != nil {
					return err
				}
			} else {
				migratedFolder = f
			}
		default:
			migratedFolder, err = gf(dash, da)
			if err != nil {
				return err
			}
		}

		if migratedFolder.UID == "" {
			return MigrationError{
				Err:     fmt.Errorf("empty folder identifier"),
				AlertId: da.ID,
			}
		}
		rule, err := m.makeAlertRule(l, *newCond, da, dash.UID, migratedFolder.UID)
		if err != nil {
			return fmt.Errorf("failed to migrate alert rule '%s' [ID:%d, DashboardUID:%s, orgID:%d]: %w", da.Name, da.ID, dash.UID, da.OrgID, err)
		}

		if _, ok := rulesPerOrg[rule.OrgID]; !ok {
			rulesPerOrg[rule.OrgID] = make(map[*models.AlertRule][]migrationStore.UidOrID)
		}
		if _, ok := rulesPerOrg[rule.OrgID][rule]; !ok {
			rulesPerOrg[rule.OrgID][rule] = extractChannelIDs(da)
		} else {
			return MigrationError{
				Err:     fmt.Errorf("duplicate generated rule UID"),
				AlertId: da.ID,
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

	err = m.migrationStore.InsertAlertRules(ctx, rulesPerOrg)
	if err != nil {
		return err
	}

	for orgID, amConfig := range amConfigPerOrg {
		if err := m.migrationStore.SaveAlertmanagerConfiguration(ctx, orgID, amConfig); err != nil {
			return err
		}
	}

	return nil
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
func getAlertFolderNameFromDashboard(dash *dashboards.Dashboard) string {
	maxLen := MaxFolderName - len(fmt.Sprintf(DASHBOARD_FOLDER, "", dash.UID))
	title := dash.Title
	if len(title) > maxLen {
		title = title[:maxLen]
	}
	return fmt.Sprintf(DASHBOARD_FOLDER, title, dash.UID) // include UID to the name to avoid collision
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
