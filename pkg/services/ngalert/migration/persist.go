package migration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

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
	skipExisting bool,
) (apiModels.OrgMigrationSummary, error) {
	oldState, err := sync.migrationStore.GetOrgMigrationState(ctx, sync.orgID)
	if err != nil {
		return apiModels.OrgMigrationSummary{}, fmt.Errorf("get state: %w", err)
	}

	delta := createDelta(oldState, dashboardUpgrades, contactPairs, skipExisting)
	summary, err := sync.syncDelta(ctx, oldState, delta)
	if err != nil {
		return apiModels.OrgMigrationSummary{}, fmt.Errorf("sync state: %w", err)
	}

	err = sync.migrationStore.SetOrgMigrationState(ctx, sync.orgID, oldState)
	if err != nil {
		return apiModels.OrgMigrationSummary{}, fmt.Errorf("save state: %w", err)
	}

	return summary, nil
}

// StateDelta contains the changes to be made to the database based on the difference between
// existing migration state and new migration state.
type StateDelta struct {
	AlertsToAdd        []*migmodels.AlertPair
	AlertsToDelete     []*migmodels.AlertPair
	DashboardsToAdd    []*migmodels.DashboardUpgrade
	DashboardsToDelete []*migrationStore.DashboardUpgrade

	ChannelsToAdd    []*migmodels.ContactPair
	ChannelsToDelete []*migrationStore.ContactPair
}

// createDelta creates a StateDelta based on the difference between oldState and the new dashboardUpgrades and contactPairs.
// If skipExisting is true, existing alerts in each dashboard as well as existing channels will be not be deleted.
// If skipExisting is false, each given dashboard will be entirely replaced with the new state and all channels will be replaced.
func createDelta(
	oldState *migrationStore.OrgMigrationState,
	dashboardUpgrades []*migmodels.DashboardUpgrade,
	contactPairs []*migmodels.ContactPair,
	skipExisting bool,
) StateDelta {
	delta := StateDelta{}
	for _, du := range dashboardUpgrades {
		oldDu, ok := oldState.MigratedDashboards[du.ID]
		if !ok {
			// Old state doesn't contain this dashboard, so add all alerts.
			delta.DashboardsToAdd = append(delta.DashboardsToAdd, du)
			continue
		}

		if !skipExisting {
			delta.DashboardsToDelete = append(delta.DashboardsToDelete, oldDu)
			delta.DashboardsToAdd = append(delta.DashboardsToAdd, du)
			continue
		}

		for _, pair := range du.MigratedAlerts {
			if _, ok := oldDu.MigratedAlerts[pair.LegacyRule.PanelID]; !ok {
				// Only add alerts that don't already exist.
				delta.AlertsToAdd = append(delta.AlertsToAdd, pair)
			}
		}
	}

	for _, newPair := range contactPairs {
		oldPair, ok := oldState.MigratedChannels[newPair.Channel.ID]
		if !ok || oldPair.NewReceiverUID == "" {
			// Old state doesn't contain this channel, or this channel is a stub. We create a new contact point and route for it.
			delta.ChannelsToAdd = append(delta.ChannelsToAdd, newPair)
			continue
		}

		// Old state contains this channel, so it's either a re-migrated channel or a deleted channel.
		if skipExisting {
			// We're only migrating new channels, so we skip this one.
			continue
		}
		delta.ChannelsToDelete = append(delta.ChannelsToDelete, oldPair)
		delta.ChannelsToAdd = append(delta.ChannelsToAdd, newPair)
	}

	return delta
}

func summaryFromDelta(delta StateDelta) apiModels.OrgMigrationSummary {
	summary := apiModels.OrgMigrationSummary{
		NewDashboards: len(delta.DashboardsToAdd),
		NewChannels:   len(delta.ChannelsToAdd),
		HasErrors:     hasErrors(delta),
	}

	for _, du := range delta.DashboardsToAdd {
		summary.NewAlerts += len(du.MigratedAlerts)
	}

	return summary
}

func hasErrors(delta StateDelta) bool {
	for _, du := range delta.DashboardsToAdd {
		for _, pair := range du.MigratedAlerts {
			if pair.Error != nil {
				return true
			}
		}
	}
	for _, pair := range delta.AlertsToAdd {
		if pair.Error != nil {
			return true
		}
	}
	for _, pair := range delta.ChannelsToAdd {
		if pair.Error != nil {
			return true
		}
	}
	return false
}

// syncDelta persists the given delta to the state and database.
func (sync *sync) syncDelta(ctx context.Context, state *migrationStore.OrgMigrationState, delta StateDelta) (apiModels.OrgMigrationSummary, error) {
	amConfig, err := sync.handleAlertmanager(ctx, state, delta)
	if err != nil {
		return apiModels.OrgMigrationSummary{}, err
	}

	err = sync.handleDeleteRules(ctx, state, delta)
	if err != nil {
		return apiModels.OrgMigrationSummary{}, err
	}

	err = sync.handleAddRules(ctx, state, delta, amConfig)
	if err != nil {
		return apiModels.OrgMigrationSummary{}, err
	}

	return summaryFromDelta(delta), nil
}

// handleAlertmanager persists the given channel delta to the state and database.
func (sync *sync) handleAlertmanager(ctx context.Context, state *migrationStore.OrgMigrationState, delta StateDelta) (*migmodels.Alertmanager, error) {
	cfg, err := sync.migrationStore.GetAlertmanagerConfig(ctx, sync.orgID)
	if err != nil {
		return nil, fmt.Errorf("get alertmanager config: %w", err)
	}
	amConfig := migmodels.FromPostableUserConfig(cfg)

	if len(delta.ChannelsToDelete) == 0 && len(delta.ChannelsToAdd) == 0 {
		return amConfig, nil
	}

	// Get the reverse relationship between rules and channels, so we can update labels on rules that reference modified channels.
	rulesWithChannels := make(map[int64][]string)
	for _, du := range state.MigratedDashboards {
		for _, pair := range du.MigratedAlerts {
			if pair.NewRuleUID != "" {
				for _, id := range pair.ChannelIDs {
					rulesWithChannels[id] = append(rulesWithChannels[id], pair.NewRuleUID)
				}
			}
		}
	}

	// Information tracked to facilitate alert rule contact point label updates.
	ruleToAddLabels := make(map[string][]string)
	ruleToRemoveLabels := make(map[string][]string)
	for _, pair := range delta.ChannelsToDelete {
		delete(state.MigratedChannels, pair.LegacyID)
		if pair.NewReceiverUID != "" {
			label := amConfig.GetContactLabel(pair.NewReceiverUID)
			for _, uid := range rulesWithChannels[pair.LegacyID] {
				ruleToRemoveLabels[uid] = append(ruleToRemoveLabels[uid], label)
			}
			// Remove receivers and routes for channels that are being replaced.
			amConfig.RemoveContactPointsAndRoutes(pair.NewReceiverUID)
		}
	}

	for _, pair := range delta.ChannelsToAdd {
		state.MigratedChannels[pair.Channel.ID] = newContactPair(pair)
		amConfig.AddReceiver(pair.ContactPoint)
		amConfig.AddRoute(pair.Route)
		if pair.ContactPoint != nil {
			for _, uid := range rulesWithChannels[pair.Channel.ID] {
				ruleToAddLabels[uid] = append(ruleToAddLabels[uid], contactLabel(pair.ContactPoint.Name))
			}
		}
	}

	config := migmodels.CleanAlertmanager(amConfig)

	// Validate the alertmanager configuration produced, this gives a chance to catch bad configuration at migration time.
	// Validation between legacy and unified alerting can be different (e.g. due to bug fixes) so this would fail the migration in that case.
	if err := sync.validateAlertmanagerConfig(config); err != nil {
		return nil, fmt.Errorf("validate AlertmanagerConfig: %w", err)
	}

	sync.log.FromContext(ctx).Info("Writing alertmanager config", "receivers", len(config.AlertmanagerConfig.Receivers), "routes", len(config.AlertmanagerConfig.Route.Routes))
	if err := sync.migrationStore.SaveAlertmanagerConfiguration(ctx, sync.orgID, config); err != nil {
		return nil, fmt.Errorf("write AlertmanagerConfig: %w", err)
	}

	// For the channels that have been changed, we need to update the labels on the alert rules that reference them.
	err = sync.replaceLabels(ctx, ruleToAddLabels, ruleToRemoveLabels)
	if err != nil {
		return nil, fmt.Errorf("replace labels: %w", err)
	}

	return amConfig, nil
}

// replaceLabels replaces labels for the given alert rule UIDs.
func (sync *sync) replaceLabels(ctx context.Context, ruleToAddLabels map[string][]string, ruleToRemoveLabels map[string][]string) error {
	var ruleUIDs []string
	for uid := range ruleToAddLabels {
		ruleUIDs = append(ruleUIDs, uid)
	}
	for uid := range ruleToRemoveLabels {
		if _, ok := ruleToAddLabels[uid]; !ok {
			ruleUIDs = append(ruleUIDs, uid)
		}
	}
	ruleLabels, err := sync.migrationStore.GetRuleLabels(ctx, sync.orgID, ruleUIDs)
	if err != nil {
		return fmt.Errorf("get rule labels: %w", err)
	}
	for key, labels := range ruleLabels {
		if labelsToRemove, ok := ruleToRemoveLabels[key.UID]; ok {
			for _, label := range labelsToRemove {
				delete(labels, label)
			}
		}
		if labelsToAdd, ok := ruleToAddLabels[key.UID]; ok {
			for _, label := range labelsToAdd {
				labels[label] = "true"
			}
		}
		err := sync.migrationStore.UpdateRuleLabels(ctx, key, labels)
		if err != nil {
			return fmt.Errorf("update rule labels: %w", err)
		}
	}
	return nil
}

// handleDeleteRules persists the given delete rule delta to the state and database.
func (sync *sync) handleDeleteRules(ctx context.Context, state *migrationStore.OrgMigrationState, delta StateDelta) error {
	if len(delta.AlertsToDelete) == 0 && len(delta.DashboardsToDelete) == 0 {
		return nil
	}
	// First we delete alerts so that empty folders can be deleted.
	uids := make([]string, 0, len(delta.AlertsToDelete))
	for _, pair := range delta.AlertsToDelete {
		du, ok := state.MigratedDashboards[pair.LegacyRule.DashboardID]
		if !ok {
			return fmt.Errorf("dashboard '%d' not found in state", pair.LegacyRule.DashboardID)
		}
		delete(du.MigratedAlerts, pair.LegacyRule.PanelID)
		if pair.Rule != nil {
			uids = append(uids, pair.Rule.UID)
		}
	}
	for _, du := range delta.DashboardsToDelete {
		delete(state.MigratedDashboards, du.DashboardID)
		for _, pair := range du.MigratedAlerts {
			if pair.NewRuleUID != "" {
				uids = append(uids, pair.NewRuleUID)
			}
		}
	}
	if len(uids) > 0 {
		err := sync.migrationStore.DeleteAlertRules(ctx, sync.orgID, uids...)
		if err != nil {
			return fmt.Errorf("delete alert rules: %w", err)
		}

		// Attempt to delete folders that might be empty.
		if len(delta.DashboardsToDelete) > 0 {
			createdbyMigration := make(map[string]struct{}, len(state.CreatedFolders))
			for _, uid := range state.CreatedFolders {
				createdbyMigration[uid] = struct{}{}
			}

			for _, du := range delta.DashboardsToDelete {
				if _, ok := createdbyMigration[du.AlertFolderUID]; ok {
					err := sync.migrationStore.DeleteFolders(ctx, sync.orgID, du.AlertFolderUID)
					if err != nil {
						if !errors.Is(err, migrationStore.ErrFolderNotDeleted) {
							return fmt.Errorf("delete folder '%s': %w", du.AlertFolderUID, err)
						}
						sync.log.FromContext(ctx).Info("Failed to delete folder during cleanup", "error", err)
					} else {
						delete(createdbyMigration, du.AlertFolderUID)
					}
				}
			}
			state.CreatedFolders = make([]string, 0, len(createdbyMigration))
			for uid := range createdbyMigration {
				state.CreatedFolders = append(state.CreatedFolders, uid)
			}
		}
	}

	return nil
}

// handleAddRules persists the given add rule delta to the state and database.
func (sync *sync) handleAddRules(ctx context.Context, state *migrationStore.OrgMigrationState, delta StateDelta, amConfig *migmodels.Alertmanager) error {
	pairs := make([]*migmodels.AlertPair, 0, len(delta.AlertsToAdd))
	for _, pair := range delta.AlertsToAdd {
		du, ok := state.MigratedDashboards[pair.LegacyRule.DashboardID]
		if !ok {
			return fmt.Errorf("dashboard '%d' not found in state", pair.LegacyRule.DashboardID)
		}

		if pair.Rule != nil {
			// These individually added alerts are created in the same folder as the existing ones.
			pair.Rule.NamespaceUID = du.AlertFolderUID
			pairs = append(pairs, pair)
		}
		du.MigratedAlerts[pair.LegacyRule.PanelID] = newAlertPair(pair)
	}
	if len(delta.DashboardsToAdd) > 0 {
		createdFolderUIDs := make(map[string]struct{}, len(state.CreatedFolders))
		for _, uid := range state.CreatedFolders {
			createdFolderUIDs[uid] = struct{}{}
		}

		for _, duToAdd := range delta.DashboardsToAdd {
			du := &migrationStore.DashboardUpgrade{
				DashboardID:    duToAdd.ID,
				MigratedAlerts: make(map[int64]*migrationStore.AlertPair, len(duToAdd.MigratedAlerts)),
			}
			pairsWithRules := make([]*migmodels.AlertPair, 0, len(duToAdd.MigratedAlerts))
			for _, pair := range duToAdd.MigratedAlerts {
				du.MigratedAlerts[pair.LegacyRule.PanelID] = newAlertPair(pair)
				if pair.Rule != nil {
					pairsWithRules = append(pairsWithRules, pair)
				}
			}

			if len(pairsWithRules) > 0 {
				l := sync.log.FromContext(ctx).New("dashboardTitle", duToAdd.Title, "dashboardUid", duToAdd.UID)
				migratedFolder, err := sync.migratedFolder(ctx, l, duToAdd.UID, duToAdd.FolderID)
				if err != nil {
					return err
				}
				du.AlertFolderUID = migratedFolder.uid
				du.Warning = migratedFolder.warning

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
			state.MigratedDashboards[du.DashboardID] = du
		}
	}

	if len(pairs) > 0 {
		sync.log.FromContext(ctx).Debug("Inserting migrated alert rules", "count", len(pairs))

		// We ensure consistency in title deduplication as well as insertions by sorting pairs first.
		sort.SliceStable(pairs, func(i, j int) bool {
			return pairs[i].LegacyRule.ID < pairs[j].LegacyRule.ID
		})

		err := sync.deduplicateTitles(ctx, pairs)
		if err != nil {
			return fmt.Errorf("deduplicate titles: %w", err)
		}
		rules, err := sync.attachContactPointLabels(ctx, state, pairs, amConfig)
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
		sync.log.FromContext(ctx).Warn("Failed to get alert rule titles for title deduplication", "error", err)
	}

	titleDedups := make(map[string]*migmodels.Deduplicator, len(namespaces))
	for _, ns := range namespaces {
		titleDedups[ns] = migmodels.NewDeduplicator(sync.migrationStore.CaseInsensitive(), store.AlertDefinitionMaxTitleLength, titles[ns]...)
	}

	for _, pair := range pairs {
		l := sync.log.FromContext(ctx).New("legacyRuleId", pair.LegacyRule.ID, "ruleUid", pair.Rule.UID)

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
func (sync *sync) attachContactPointLabels(ctx context.Context, state *migrationStore.OrgMigrationState, pairs []*migmodels.AlertPair, amConfig *migmodels.Alertmanager) ([]models.AlertRule, error) {
	rules := make([]models.AlertRule, 0, len(pairs))
	for _, pair := range pairs {
		l := sync.log.FromContext(ctx).New("legacyRuleId", pair.LegacyRule.ID, "ruleUid", pair.Rule.UID)
		alertChannels, err := sync.extractChannels(ctx, pair.LegacyRule)
		if err != nil {
			return nil, fmt.Errorf("extract channel IDs: %w", err)
		}

		statePair := state.MigratedDashboards[pair.LegacyRule.DashboardID].MigratedAlerts[pair.LegacyRule.PanelID]
		statePair.ChannelIDs = make([]int64, 0, len(alertChannels))
		for _, c := range alertChannels {
			statePair.ChannelIDs = append(statePair.ChannelIDs, c.ID)
			channelPair, ok := state.MigratedChannels[c.ID]
			if ok {
				label := amConfig.GetContactLabel(channelPair.NewReceiverUID)
				if label != "" {
					pair.Rule.Labels[label] = "true"
				}
			} else {
				l.Warn("Failed to find migrated channel", "channel", c.Name)
				// Creating stub so that when we eventually migrate the channel, we can update the labels on this rule.
				state.MigratedChannels[c.ID] = &migrationStore.ContactPair{LegacyID: c.ID, Error: "channel not upgraded"}
			}
		}
		rules = append(rules, *pair.Rule)
	}
	return rules, nil
}

// extractChannels extracts notification channels from the given legacy dashboard alert parsed settings.
func (sync *sync) extractChannels(ctx context.Context, alert *legacymodels.Alert) ([]*legacymodels.AlertNotification, error) {
	l := sync.log.FromContext(ctx).New("ruleId", alert.ID, "ruleName", alert.Name)
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
			err := validateReceiver(gr, sync.getDecryptedValue)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func newContactPair(pair *migmodels.ContactPair) *migrationStore.ContactPair {
	p := &migrationStore.ContactPair{
		LegacyID: pair.Channel.ID,
	}
	if pair.Error != nil {
		p.Error = pair.Error.Error()
	}

	if pair.ContactPoint != nil {
		p.NewReceiverUID = pair.ContactPoint.UID
	}
	return p
}

func newAlertPair(a *migmodels.AlertPair) *migrationStore.AlertPair {
	pair := &migrationStore.AlertPair{}
	if a.Error != nil {
		pair.Error = a.Error.Error()
	}
	if a.LegacyRule != nil {
		pair.LegacyID = a.LegacyRule.ID
		pair.PanelID = a.LegacyRule.PanelID
	}
	if a.Rule != nil {
		pair.NewRuleUID = a.Rule.UID
	}
	return pair
}
