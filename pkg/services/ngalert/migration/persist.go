package migration

import (
	"context"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	apiModels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// sync is a helper struct for persisting migration changes to the database.
type sync struct {
	log   log.Logger
	orgID int64

	migrationStore    migrationStore.Store
	getDecryptedValue func(ctx context.Context, sjd map[string][]byte, key, fallback string) string
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
	}
}

// syncAndSaveState persists the given dashboardUpgrades and contactPairs to the database.
func (sync *sync) syncAndSaveState(
	ctx context.Context,
	dashboardUpgrades []*migmodels.DashboardUpgrade,
	contactPairs []*migmodels.ContactPair,
) error {
	delta, err := createDelta(dashboardUpgrades, contactPairs)
	if err != nil {
		return fmt.Errorf("state delta: %w", err)
	}

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
) (StateDelta, error) {
	return StateDelta{
		DashboardsToAdd: dashboardUpgrades,
		ChannelsToAdd:   contactPairs,
	}, nil
}

// syncDelta persists the given delta to the state and database.
func (sync *sync) syncDelta(ctx context.Context, delta StateDelta) (*migrationStore.OrgMigrationState, error) {
	state := &migrationStore.OrgMigrationState{
		OrgID:          sync.orgID,
		CreatedFolders: make([]string, 0),
	}

	err := sync.handleAlertmanager(ctx, delta)
	if err != nil {
		return nil, err
	}

	err = sync.handleAddRules(ctx, state, delta)
	if err != nil {
		return nil, err
	}

	return state, nil
}

// handleAlertmanager persists the given channel delta to the state and database.
func (sync *sync) handleAlertmanager(ctx context.Context, delta StateDelta) error {
	amConfig := migmodels.NewAlertmanager()

	if len(delta.ChannelsToAdd) == 0 {
		return nil
	}

	for _, pair := range delta.ChannelsToAdd {
		amConfig.AddReceiver(pair.ContactPoint)
		amConfig.AddRoute(pair.Route)
	}

	// Validate the alertmanager configuration produced, this gives a chance to catch bad configuration at migration time.
	// Validation between legacy and unified alerting can be different (e.g. due to bug fixes) so this would fail the migration in that case.
	if err := sync.validateAlertmanagerConfig(amConfig.Config); err != nil {
		return fmt.Errorf("validate AlertmanagerConfig: %w", err)
	}

	sync.log.Info("Writing alertmanager config", "receivers", len(amConfig.Config.AlertmanagerConfig.Receivers), "routes", len(amConfig.Config.AlertmanagerConfig.Route.Routes))
	if err := sync.migrationStore.SaveAlertmanagerConfiguration(ctx, sync.orgID, amConfig.Config); err != nil {
		return fmt.Errorf("write AlertmanagerConfig: %w", err)
	}

	return nil
}

// handleAddRules persists the given add rule delta to the state and database.
func (sync *sync) handleAddRules(ctx context.Context, state *migrationStore.OrgMigrationState, delta StateDelta) error {
	createdFolderUIDs := make(map[string]struct{})
	if len(delta.DashboardsToAdd) > 0 {
		for _, duToAdd := range delta.DashboardsToAdd {
			if _, ok := createdFolderUIDs[duToAdd.NewFolderUID]; duToAdd.CreatedFolder && duToAdd.NewFolderUID != "" && !ok {
				createdFolderUIDs[duToAdd.NewFolderUID] = struct{}{}
				state.CreatedFolders = append(state.CreatedFolders, duToAdd.NewFolderUID)
			}
			rules := make([]models.AlertRule, 0)
			for _, pair := range duToAdd.MigratedAlerts {
				rules = append(rules, *pair.Rule)
			}
			if len(rules) > 0 {
				sync.log.Info("Inserting migrated alert rules", "count", len(rules))
				err := sync.migrationStore.InsertAlertRules(ctx, rules...)
				if err != nil {
					return fmt.Errorf("insert alert rules: %w", err)
				}
			}
		}
	}

	return nil
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
