package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/folder"
	apiModels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

// sync is a helper struct for persisting migration changes to the database.
type sync struct {
	log   log.Logger
	orgID int64

	migrationStore    migrationStore.Store
	getDecryptedValue func(ctx context.Context, sjd map[string][]byte, key, fallback string) string
	channelCache      *ChannelCache

	// Caches used during custom folder creation.
	permissionsMap        map[int64]map[permissionHash]*folder.Folder   // Parent Folder ID -> unique dashboard permission -> custom folder.
	folderCache           map[int64]*folder.Folder                      // Folder ID -> Folder.
	folderPermissionCache map[string][]accesscontrol.ResourcePermission // Folder UID -> Folder Permissions.
	generalAlertingFolder *folder.Folder
}

// newSync creates a new migrationService for the given orgID.
func (ms *migrationService) newSync(orgID int64) *sync {
	return &sync{
		orgID: orgID,
		log:   ms.log.New("orgID", orgID),

		migrationStore: ms.migrationStore,
		getDecryptedValue: func(ctx context.Context, sjd map[string][]byte, key, fallback string) string {
			return ms.encryptionService.GetDecryptedValue(ctx, sjd, key, fallback)
		},
		channelCache: ms.newChannelCache(orgID),

		permissionsMap:        make(map[int64]map[permissionHash]*folder.Folder),
		folderCache:           make(map[int64]*folder.Folder),
		folderPermissionCache: make(map[string][]accesscontrol.ResourcePermission),
	}
}

// syncAndSaveState persists the given dashboardUpgrades and contactPairs to the database.
func (sync *sync) syncAndSaveState(
	ctx context.Context,
	dashboardUpgrades []*migmodels.DashboardUpgrade,
	contactPairs []*migmodels.ContactPair,
) error {
	delta := createDelta(dashboardUpgrades, contactPairs)
	state, err := sync.syncDelta(ctx, delta)
	if err != nil {
		return fmt.Errorf("sync state: %w", err)
	}

	err = sync.migrationStore.SetOrgMigrationState(ctx, sync.orgID, state)
	if err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	return nil
}

// StateDelta contains the changes to be made to the database based on the difference between
// existing migration state and new migration state.
type StateDelta struct {
	DashboardsToAdd []*migmodels.DashboardUpgrade
	ChannelsToAdd   []*migmodels.ContactPair
}

// createDelta creates a StateDelta from the new dashboards upgrades and contact pairs.
func createDelta(
	dashboardUpgrades []*migmodels.DashboardUpgrade,
	contactPairs []*migmodels.ContactPair,
) StateDelta {
	return StateDelta{
		DashboardsToAdd: dashboardUpgrades,
		ChannelsToAdd:   contactPairs,
	}
}

// syncDelta persists the given delta to the state and database.
func (sync *sync) syncDelta(ctx context.Context, delta StateDelta) (*migrationStore.OrgMigrationState, error) {
	state := &migrationStore.OrgMigrationState{
		OrgID:          sync.orgID,
		CreatedFolders: make([]string, 0),
	}

	amConfig, err := sync.handleAlertmanager(ctx, delta)
	if err != nil {
		return nil, err
	}

	err = sync.handleAddRules(ctx, state, delta, amConfig)
	if err != nil {
		return nil, err
	}

	return state, nil
}

// handleAlertmanager persists the given channel delta to the state and database.
func (sync *sync) handleAlertmanager(ctx context.Context, delta StateDelta) (*migmodels.Alertmanager, error) {
	amConfig := migmodels.NewAlertmanager()

	if len(delta.ChannelsToAdd) == 0 {
		return amConfig, nil
	}

	for _, pair := range delta.ChannelsToAdd {
		amConfig.AddReceiver(pair.ContactPoint)
		amConfig.AddRoute(pair.Route)
	}

	// Validate the alertmanager configuration produced, this gives a chance to catch bad configuration at migration time.
	// Validation between legacy and unified alerting can be different (e.g. due to bug fixes) so this would fail the migration in that case.
	if err := sync.validateAlertmanagerConfig(amConfig.Config); err != nil {
		return nil, fmt.Errorf("validate AlertmanagerConfig: %w", err)
	}

	sync.log.Info("Writing alertmanager config", "receivers", len(amConfig.Config.AlertmanagerConfig.Receivers), "routes", len(amConfig.Config.AlertmanagerConfig.Route.Routes))
	if err := sync.migrationStore.SaveAlertmanagerConfiguration(ctx, sync.orgID, amConfig.Config); err != nil {
		return nil, fmt.Errorf("write AlertmanagerConfig: %w", err)
	}

	return amConfig, nil
}

// handleAddRules persists the given add rule delta to the state and database.
func (sync *sync) handleAddRules(ctx context.Context, state *migrationStore.OrgMigrationState, delta StateDelta, amConfig *migmodels.Alertmanager) error {
	pairs := make([]*migmodels.AlertPair, 0)
	createdFolderUIDs := make(map[string]struct{})
	for _, duToAdd := range delta.DashboardsToAdd {
		pairsWithRules := make([]*migmodels.AlertPair, 0, len(duToAdd.MigratedAlerts))
		for _, pair := range duToAdd.MigratedAlerts {
			if pair.Rule != nil {
				pairsWithRules = append(pairsWithRules, pair)
			}
		}

		if len(pairsWithRules) > 0 {
			l := sync.log.New("dashboardTitle", duToAdd.Title, "dashboardUid", duToAdd.UID)
			migratedFolder, err := sync.migratedFolder(ctx, l, duToAdd.UID, duToAdd.FolderID)
			if err != nil {
				return err
			}

			// Keep track of folders created by the migration.
			if _, exists := createdFolderUIDs[migratedFolder.uid]; migratedFolder.created && !exists {
				createdFolderUIDs[migratedFolder.uid] = struct{}{}
				state.CreatedFolders = append(state.CreatedFolders, migratedFolder.uid)
			}

			for _, pair := range pairsWithRules {
				pair.Rule.NamespaceUID = migratedFolder.uid
				pairs = append(pairs, pair)
			}
		}
	}

	if len(pairs) > 0 {
		sync.log.Debug("Inserting migrated alert rules", "count", len(pairs))

		// We ensure consistency in title deduplication as well as insertions by sorting pairs first.
		sort.SliceStable(pairs, func(i, j int) bool {
			return pairs[i].LegacyRule.ID < pairs[j].LegacyRule.ID
		})

		err := sync.deduplicateTitles(ctx, pairs)
		if err != nil {
			return fmt.Errorf("deduplicate titles: %w", err)
		}
		rules, err := sync.attachContactPointLabels(ctx, pairs, amConfig)
		if err != nil {
			return fmt.Errorf("attach contact point labels: %w", err)
		}

		err = sync.migrationStore.InsertAlertRules(ctx, rules...)
		if err != nil {
			return fmt.Errorf("insert alert rules: %w", err)
		}
	}
	return nil
}

// deduplicateTitles ensures that the alert rule titles are unique within the folder.
func (sync *sync) deduplicateTitles(ctx context.Context, pairs []*migmodels.AlertPair) error {
	// First pass to find namespaces.
	seen := make(map[string]struct{})
	namespaces := make([]string, 0)
	for _, pair := range pairs {
		if _, ok := seen[pair.Rule.NamespaceUID]; !ok {
			namespaces = append(namespaces, pair.Rule.NamespaceUID)
			seen[pair.Rule.NamespaceUID] = struct{}{}
		}
	}

	// Populate deduplicators from database.
	titles, err := sync.migrationStore.GetAlertRuleTitles(ctx, sync.orgID, namespaces...)
	if err != nil {
		sync.log.Warn("Failed to get alert rule titles for title deduplication", "error", err)
	}

	titleDedups := make(map[string]*migmodels.Deduplicator, len(namespaces))
	for _, ns := range namespaces {
		titleDedups[ns] = migmodels.NewDeduplicator(sync.migrationStore.CaseInsensitive(), store.AlertDefinitionMaxTitleLength, titles[ns]...)
	}

	for _, pair := range pairs {
		l := sync.log.New("legacyRuleId", pair.LegacyRule.ID, "ruleUid", pair.Rule.UID)

		// Here we ensure that the alert rule title is unique within the folder.
		titleDeduplicator := titleDedups[pair.Rule.NamespaceUID]
		name, err := titleDeduplicator.Deduplicate(pair.Rule.Title)
		if err != nil {
			return err
		}
		if name != pair.Rule.Title {
			l.Info("Alert rule title modified to be unique within folder", "old", pair.Rule.Title, "new", name)
			pair.Rule.Title = name
		}
	}

	return nil
}

// attachContactPointLabels attaches contact point labels to the given alert rules.
func (sync *sync) attachContactPointLabels(ctx context.Context, pairs []*migmodels.AlertPair, amConfig *migmodels.Alertmanager) ([]models.AlertRule, error) {
	rules := make([]models.AlertRule, 0, len(pairs))
	for _, pair := range pairs {
		alertChannels, err := sync.extractChannels(ctx, pair.LegacyRule)
		if err != nil {
			return nil, fmt.Errorf("extract channel IDs: %w", err)
		}

		for _, c := range alertChannels {
			pair.Rule.Labels[contactLabel(c.Name)] = "true"
		}

		rules = append(rules, *pair.Rule)
	}
	return rules, nil
}

// extractChannels extracts notification channels from the given legacy dashboard alert parsed settings.
func (sync *sync) extractChannels(ctx context.Context, alert *legacymodels.Alert) ([]*legacymodels.AlertNotification, error) {
	l := sync.log.New("ruleId", alert.ID, "ruleName", alert.Name)
	rawSettings, err := json.Marshal(alert.Settings)
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	var parsedSettings dashAlertSettings
	err = json.Unmarshal(rawSettings, &parsedSettings)
	if err != nil {
		return nil, fmt.Errorf("parse settings: %w", err)
	}

	// Extracting channels.
	channels := make([]*legacymodels.AlertNotification, 0, len(parsedSettings.Notifications))
	for _, key := range parsedSettings.Notifications {
		// Either id or uid can be defined in the dashboard alert notification settings. See alerting.NewRuleFromDBAlert.
		if key.ID == 0 && key.UID == "" {
			l.Warn("Alert notification has no ID or UID, skipping", "notificationKey", key)
			continue
		}
		if c, err := sync.channelCache.Get(ctx, key); err != nil {
			return nil, fmt.Errorf("get alert notification: %w", err)
		} else if c != nil {
			channels = append(channels, c)
			continue
		}
		l.Warn("Failed to get alert notification, skipping", "notificationKey", key)
	}
	return channels, nil
}

// validateAlertmanagerConfig validates the alertmanager configuration produced by the migration against the receivers.
func (sync *sync) validateAlertmanagerConfig(config *apiModels.PostableUserConfig) error {
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
			}, sync.getDecryptedValue)
			if err != nil {
				return err
			}
		}
	}

	return nil
}
