package notifier

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/alerting/definition"
	alertingNotify "github.com/grafana/alerting/notify"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var (
	// ErrAlertmanagerReceiverInUse is primarily meant for when a receiver is used by a rule and is being deleted.
	ErrAlertmanagerReceiverInUse = errutil.BadRequest("alerting.notifications.alertmanager.receiverInUse").MustTemplate("receiver [Name: {{ .Public.Receiver }}] is used by rule: {{ .Error }}",
		errutil.WithPublic(
			"receiver [Name: {{ .Public.Receiver }}] is used by rule",
		))
	// ErrAlertmanagerTimeIntervalInUse is primarily meant for when a time interval is used by a rule and is being deleted.
	ErrAlertmanagerTimeIntervalInUse = errutil.BadRequest("alerting.notifications.alertmanager.intervalInUse").MustTemplate("time interval [Name: {{ .Public.Interval }}] is used by rule: {{ .Error }}",
		errutil.WithPublic(
			"time interval [Name: {{ .Public.Interval }}] is used by rule",
		))

	msgAlertmanagerMultipleExtraConfigsUnsupported = "multiple extra configurations are not supported, found another configuration with identifier: {{ .Public.Identifier }}"
	ErrAlertmanagerMultipleExtraConfigsUnsupported = errutil.Conflict("alerting.notifications.alertmanager.multipleExtraConfigsUnsupported").MustTemplate(
		msgAlertmanagerMultipleExtraConfigsUnsupported,
		errutil.WithPublic(msgAlertmanagerMultipleExtraConfigsUnsupported),
	)

	ErrIdentifierAlreadyExists = errutil.BadRequest("alerting.notifications.alertmanager.identifierAlreadyExists").MustTemplate("identifier [{{ .Public.Identifier }}] already used by existing managed routes",
		errutil.WithPublic(
			"Identifier [{{ .Public.Identifier }}] is already used by existing managed routes. Use another identifier or delete the existing route.",
		))
)

type UnknownReceiverError struct {
	UID string
}

func (e UnknownReceiverError) Error() string {
	return fmt.Sprintf("unknown receiver: %s", e.UID)
}

type AlertmanagerConfigRejectedError struct {
	Inner error
}

func (e AlertmanagerConfigRejectedError) Error() string {
	return fmt.Sprintf("failed to save and apply Alertmanager configuration: %s", e.Inner.Error())
}

type configurationStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
}

func (moa *MultiOrgAlertmanager) PrepareConfig(
	ctx context.Context,
	orgID int64,
	cfg *models.AlertConfiguration,
	onInvalid InvalidReceiversAction,
) (alertingNotify.NotificationsConfiguration, error) {
	prepared, err := Load([]byte(cfg.AlertmanagerConfiguration))
	if err != nil {
		return alertingNotify.NotificationsConfiguration{}, fmt.Errorf("failed to parse Alertmanager config: %w", err)
	}

	if err := moa.Crypto.DecryptExtraConfigs(ctx, prepared); err != nil {
		return alertingNotify.NotificationsConfiguration{}, fmt.Errorf("failed to decrypt external configurations: %w", err)
	}

	mergeResult, err := prepared.GetMergedAlertmanagerConfig()
	if err != nil {
		return alertingNotify.NotificationsConfiguration{}, fmt.Errorf("failed to get full alertmanager configuration: %w", err)
	}
	if logInfo := mergeResult.LogContext(); len(logInfo) > 0 {
		moa.logger.Info("Configurations merged successfully but some resources were renamed", logInfo...)
	}
	preparedConfig := mergeResult.Config
	//nolint:staticcheck // not yet migrated to OpenFeature
	if moa.featureManager.IsEnabledGlobally(featuremgmt.FlagAlertingV0ReceiversAsLegacy) {
		moa.logger.Info("Skipping converting Mimir receivers to Grafana receivers", "identifier", mergeResult.Identifier)
	} else {
		converted, failed := 0, 0
		for idx, recv := range preparedConfig.Receivers {
			if !recv.HasMimirIntegrations() {
				continue
			}
			grafana, err := legacy_storage.PostableMimirReceiverToPostableGrafanaReceiver(recv)
			if err != nil {
				moa.logger.Warn("Failed to convert Mimir receiver to Grafana receiver. Using receiver as is", "identifier", mergeResult.Identifier, "receiver", recv.Name, "err", err)
				failed++
				continue
			}
			preparedConfig.Receivers[idx] = grafana
			converted++
		}
		if converted > 0 || failed > 0 {
			moa.logger.Info("Converted Mimir receivers to Grafana receivers", "identifier", mergeResult.Identifier, "converted", converted, "failed", failed)
		}
	}

	// Add managed routes and extra route as managed route to the configuration.
	// Also add extra inhibition rules to the configuration if extra route exists and doesn't conflict with existing
	// route
	//nolint:staticcheck // not yet migrated to OpenFeature
	if moa.featureManager.IsEnabledGlobally(featuremgmt.FlagAlertingMultiplePolicies) {
		managedRoutes := maps.Clone(prepared.ManagedRoutes)
		if managedRoutes == nil {
			managedRoutes = make(map[string]*definitions.Route)
		}

		managedInhibitionRules := maps.Clone(prepared.ManagedInhibitionRules)
		if managedInhibitionRules == nil {
			managedInhibitionRules = make(definitions.ManagedInhibitionRules)
		}

		if mergeResult.ExtraRoute != nil {
			if _, ok := managedRoutes[mergeResult.Identifier]; ok {
				moa.logger.Warn("Imported configuration name conflicts with existing managed routes, skipping adding imported config.", "identifier", mergeResult.Identifier)
			} else {
				managedRoutes[mergeResult.Identifier] = mergeResult.ExtraRoute

				importedRules, err := legacy_storage.BuildManagedInhibitionRules(mergeResult.Identifier, mergeResult.ExtraInhibitRules)
				if err != nil {
					moa.logger.Warn("failed to build managed inhibition rules for imported configuration", "identifier", mergeResult.Identifier, "err", err)
				} else {
					maps.Copy(managedInhibitionRules, importedRules)
				}
			}
		}
		preparedConfig.Route = legacy_storage.WithManagedRoutes(preparedConfig.Route, managedRoutes)
		preparedConfig.InhibitRules = legacy_storage.WithManagedInhibitionRules(preparedConfig.InhibitRules, managedInhibitionRules)
	}

	if err := AddAutogenConfig(ctx, moa.logger, moa.configStore, orgID, &preparedConfig, onInvalid, moa.featureManager); err != nil {
		return alertingNotify.NotificationsConfiguration{}, err
	}

	prepared.AlertmanagerConfig = preparedConfig

	return PostableAPIConfigToNotificationsConfiguration(prepared, moa.limits), nil
}

func (moa *MultiOrgAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context, orgId int64) error {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	orgAM, err := moa.alertmanagerForOrg(orgId)
	if err != nil {
		return err
	}

	previousConfig, cleanPermissionsErr := moa.configStore.GetLatestAlertmanagerConfiguration(ctx, orgId)

	err = moa.saveAndApplyDefaultConfig(ctx, orgId, orgAM)
	if err != nil {
		return err
	}

	// Attempt to cleanup permissions for receivers that are no longer defined and add defaults for new receivers.
	// Failure should not prevent the default config from being applied.
	if cleanPermissionsErr == nil {
		cleanPermissionsErr = func() error {
			defaultedConfig, err := moa.configStore.GetLatestAlertmanagerConfiguration(ctx, orgId)
			if err != nil {
				return err
			}
			newReceiverNames, err := extractReceiverNames(defaultedConfig.AlertmanagerConfiguration)
			if err != nil {
				return err
			}
			return moa.cleanPermissions(ctx, orgId, previousConfig, newReceiverNames)
		}()
	}
	if cleanPermissionsErr != nil {
		moa.logger.Error("Failed to clean permissions for receivers", "error", cleanPermissionsErr)
	}

	return nil
}

// ApplyConfig will apply the given alertmanager configuration for a given org.
// Can be used to force regeneration of autogenerated routes.
func (moa *MultiOrgAlertmanager) ApplyConfig(ctx context.Context, orgId int64, dbConfig *models.AlertConfiguration) (bool, error) {
	am, err := moa.AlertmanagerFor(orgId)
	if err != nil {
		// It's okay if the alertmanager isn't ready yet, we're changing its config anyway.
		if !errors.Is(err, ErrAlertmanagerNotReady) {
			return false, err
		}
	}

	applied, err := moa.applyConfig(ctx, orgId, am, dbConfig)
	if err != nil {
		return false, fmt.Errorf("failed to apply configuration: %w", err)
	}
	return applied, nil
}

// GetAlertmanagerConfiguration returns the latest alertmanager configuration for a given org.
// If withAutogen is true, the configuration will be augmented with autogenerated routes.
// If withMergedExtraConfig is true, any extra configurations will be merged into the main configuration.
func (moa *MultiOrgAlertmanager) GetAlertmanagerConfiguration(ctx context.Context, org int64, withAutogen bool, withMergedExtraConfig bool) (definitions.GettableUserConfig, error) {
	amConfig, err := moa.configStore.GetLatestAlertmanagerConfiguration(ctx, org)
	if err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to get latest configuration: %w", err)
	}

	cfg, err := moa.gettableUserConfigFromAMConfigString(ctx, org, amConfig.AlertmanagerConfiguration, withMergedExtraConfig)
	if err != nil {
		return definitions.GettableUserConfig{}, err
	}

	if withAutogen {
		// We validate the notification settings in a similar way to when we POST.
		// Otherwise, broken settings (e.g. a receiver that doesn't exist) will cause the config returned here to be
		// different than the config currently in-use.
		// TODO: Preferably, we'd be getting the config directly from the in-memory AM so adding the autogen config would not be necessary.
		err := AddAutogenConfig(ctx, moa.logger, moa.configStore, org, &cfg.AlertmanagerConfig, LogInvalidReceivers, moa.featureManager)
		if err != nil {
			return definitions.GettableUserConfig{}, err
		}
	}
	return cfg, nil
}

// ActivateHistoricalConfiguration will set the current alertmanager configuration to a previous value based on the provided
// alert_configuration_history id.
func (moa *MultiOrgAlertmanager) ActivateHistoricalConfiguration(ctx context.Context, orgId int64, id int64) error {
	config, err := moa.configStore.GetHistoricalConfiguration(ctx, orgId, id)
	if err != nil {
		return fmt.Errorf("failed to get historical alertmanager configuration: %w", err)
	}

	cfg, err := Load([]byte(config.AlertmanagerConfiguration))
	if err != nil {
		return fmt.Errorf("failed to unmarshal historical alertmanager configuration: %w", err)
	}

	am, err := moa.AlertmanagerFor(orgId)
	if err != nil {
		// It's okay if the alertmanager isn't ready yet, we're changing its config anyway.
		if !errors.Is(err, ErrAlertmanagerNotReady) {
			return err
		}
	}

	previousConfig, cleanPermissionsErr := moa.configStore.GetLatestAlertmanagerConfiguration(ctx, orgId)

	if len(cfg.ExtraConfigs) > 0 {
		if err := moa.Crypto.EncryptExtraConfigs(ctx, cfg); err != nil {
			return fmt.Errorf("failed to encrypt external configurations: %w", err)
		}
	}

	if err := moa.saveAndApplyConfig(ctx, orgId, am, cfg); err != nil {
		moa.logger.Error("Unable to save and apply historical alertmanager configuration", "error", err, "org", orgId, "id", id)
		return AlertmanagerConfigRejectedError{err}
	}
	moa.logger.Info("Applied historical alertmanager configuration", "org", orgId, "id", id)

	// Attempt to cleanup permissions for receivers that are no longer defined and add defaults for new receivers.
	// Failure should not prevent the default config from being applied.
	if cleanPermissionsErr == nil {
		cleanPermissionsErr = func() error {
			newReceiverNames, err := extractReceiverNames(config.AlertmanagerConfiguration)
			if err != nil {
				return err
			}
			return moa.cleanPermissions(ctx, orgId, previousConfig, newReceiverNames)
		}()
	}
	if cleanPermissionsErr != nil {
		moa.logger.Error("Failed to clean permissions for receivers", "error", cleanPermissionsErr)
	}

	return nil
}

// GetAppliedAlertmanagerConfigurations returns the last n configurations marked as applied for a given org.
func (moa *MultiOrgAlertmanager) GetAppliedAlertmanagerConfigurations(ctx context.Context, org int64, limit int) ([]*definitions.GettableHistoricUserConfig, error) {
	configs, err := moa.configStore.GetAppliedConfigurations(ctx, org, limit)
	if err != nil {
		return []*definitions.GettableHistoricUserConfig{}, fmt.Errorf("failed to get applied configurations: %w", err)
	}

	gettableHistoricConfigs := make([]*definitions.GettableHistoricUserConfig, 0, len(configs))
	for _, config := range configs {
		appliedAt := strfmt.DateTime(time.Unix(config.LastApplied, 0).UTC())
		gettableConfig, err := moa.gettableUserConfigFromAMConfigString(ctx, org, config.AlertmanagerConfiguration, false)
		if err != nil {
			// If there are invalid records, skip them and return the valid ones.
			moa.logger.Warn("Invalid configuration found in alert configuration history table", "id", config.ID, "orgID", org)
			continue
		}

		gettableHistoricConfig := definitions.GettableHistoricUserConfig{
			ID:                      config.ID,
			TemplateFiles:           gettableConfig.TemplateFiles,
			TemplateFileProvenances: gettableConfig.TemplateFileProvenances,
			AlertmanagerConfig:      gettableConfig.AlertmanagerConfig,
			LastApplied:             &appliedAt,
		}
		gettableHistoricConfigs = append(gettableHistoricConfigs, &gettableHistoricConfig)
	}

	return gettableHistoricConfigs, nil
}

func (moa *MultiOrgAlertmanager) gettableUserConfigFromAMConfigString(ctx context.Context, orgID int64, config string, withMergedExtraConfig bool) (definitions.GettableUserConfig, error) {
	cfg, err := Load([]byte(config))
	if err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to unmarshal alertmanager configuration: %w", err)
	}

	err = moa.Crypto.DecryptExtraConfigs(ctx, cfg)
	if err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to decrypt external configurations: %w", err)
	}

	var alertmanagerConfig definitions.PostableApiAlertingConfig
	var templateFiles map[string]string
	if withMergedExtraConfig && len(cfg.ExtraConfigs) > 0 {
		mergeResult, err := cfg.GetMergedAlertmanagerConfig()
		if err != nil {
			return definitions.GettableUserConfig{}, fmt.Errorf("failed to merge configuration: %w", err)
		}
		alertmanagerConfig = mergeResult.Config

		mergedTemplates := cfg.GetMergedTemplateDefinitions()
		templateFiles = make(map[string]string, len(mergedTemplates))
		for _, t := range mergedTemplates {
			templateFiles[t.Name] = t.Content
		}
	} else {
		alertmanagerConfig = cfg.AlertmanagerConfig
		templateFiles = cfg.TemplateFiles
	}

	result := definitions.GettableUserConfig{
		TemplateFiles: templateFiles,
		AlertmanagerConfig: definitions.GettableApiAlertingConfig{
			Config: alertmanagerConfig.Config,
		},
		ExtraConfigs: cfg.ExtraConfigs,
	}

	// First we encrypt the secure settings.
	// This is done to ensure that any secure settings incorrectly stored in Settings are encrypted and moved to
	// SecureSettings. This can happen if an integration definition is updated to make a field secure.
	if err := EncryptReceiverConfigSettings(alertmanagerConfig.Receivers, func(ctx context.Context, payload []byte) ([]byte, error) {
		return moa.Crypto.Encrypt(ctx, payload, secrets.WithoutScope())
	}); err != nil {
		return definitions.GettableUserConfig{}, fmt.Errorf("failed to encrypt receivers: %w", err)
	}

	for _, recv := range alertmanagerConfig.Receivers {
		receivers := make([]*definitions.GettableGrafanaReceiver, 0, len(recv.GrafanaManagedReceivers))
		for _, pr := range recv.GrafanaManagedReceivers {
			secureFields := make(map[string]bool, len(pr.SecureSettings))
			for k := range pr.SecureSettings {
				decryptedValue, err := moa.Crypto.getDecryptedSecret(pr, k)
				if err != nil {
					return definitions.GettableUserConfig{}, fmt.Errorf("failed to decrypt stored secure setting: %w", err)
				}
				if decryptedValue == "" {
					continue
				}
				secureFields[k] = true
			}
			gr := definitions.GettableGrafanaReceiver{
				UID:                   pr.UID,
				Name:                  pr.Name,
				Type:                  pr.Type,
				Version:               pr.Version,
				DisableResolveMessage: pr.DisableResolveMessage,
				Settings:              pr.Settings,
				SecureFields:          secureFields,
			}
			receivers = append(receivers, &gr)
		}
		gettableApiReceiver := definitions.GettableApiReceiver{
			GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
				GrafanaManagedReceivers: receivers,
			},
		}
		gettableApiReceiver.Name = recv.Name
		result.AlertmanagerConfig.Receivers = append(result.AlertmanagerConfig.Receivers, &gettableApiReceiver)
	}

	result, err = moa.mergeProvenance(ctx, result, orgID)
	if err != nil {
		return definitions.GettableUserConfig{}, err
	}

	return result, nil
}

// modifyAndApplyExtraConfiguration is a helper function that loads the current configuration,
// applies a modification function to the ExtraConfigs, and saves the result.
func (moa *MultiOrgAlertmanager) modifyAndApplyExtraConfiguration(
	ctx context.Context,
	org int64,
	modifyFn func([]definitions.ExtraConfiguration) ([]definitions.ExtraConfiguration, error),
	dryRun bool,
) (definition.RenameResources, error) {
	currentCfg, err := moa.configStore.GetLatestAlertmanagerConfiguration(ctx, org)
	if err != nil {
		return definition.RenameResources{}, fmt.Errorf("failed to get current configuration: %w", err)
	}

	cfg, err := Load([]byte(currentCfg.AlertmanagerConfiguration))
	if err != nil {
		return definition.RenameResources{}, fmt.Errorf("failed to unmarshal current alertmanager configuration: %w", err)
	}

	cfg.ExtraConfigs, err = modifyFn(cfg.ExtraConfigs)
	if err != nil {
		return definition.RenameResources{}, fmt.Errorf("failed to apply extra configuration: %w", err)
	}

	if len(cfg.ManagedRoutes) > 0 {
		for _, c := range cfg.ExtraConfigs {
			if _, ok := cfg.ManagedRoutes[c.Identifier]; ok {
				return definition.RenameResources{}, ErrIdentifierAlreadyExists.Build(errutil.TemplateData{Public: map[string]interface{}{"Identifier": c.Identifier}})
			}
		}
	}

	merge, err := cfg.GetMergedAlertmanagerConfig()
	if err != nil {
		return definition.RenameResources{}, fmt.Errorf("cannot merge imported configuration into Grafana: %w", err)
	}

	if dryRun {
		moa.logger.Debug("Dry run: extra configuration validated successfully", "org", org)
		return merge.RenameResources, nil
	}

	am, err := moa.AlertmanagerFor(org)
	if err != nil {
		// It's okay if the alertmanager isn't ready yet, we're changing its config anyway.
		if !errors.Is(err, ErrAlertmanagerNotReady) {
			return definition.RenameResources{}, err
		}
	}

	if err := moa.Crypto.EncryptExtraConfigs(ctx, cfg); err != nil {
		return definition.RenameResources{}, fmt.Errorf("failed to encrypt external configurations: %w", err)
	}

	if err := moa.saveAndApplyConfig(ctx, org, am, cfg); err != nil {
		moa.logger.Error("Unable to save and apply alertmanager configuration with extra config", "error", err, "org", org)
		return definition.RenameResources{}, AlertmanagerConfigRejectedError{err}
	}

	moa.logger.Info("Applied alertmanager configuration with extra config", "org", org)
	return merge.RenameResources, nil
}

// SaveAndApplyExtraConfiguration adds or replaces an ExtraConfiguration while preserving the main AlertmanagerConfig.
func (moa *MultiOrgAlertmanager) SaveAndApplyExtraConfiguration(ctx context.Context, org int64, extraConfig definitions.ExtraConfiguration, replace bool, dryRun bool) (definition.RenameResources, error) {
	modifyFunc := func(configs []definitions.ExtraConfiguration) ([]definitions.ExtraConfiguration, error) {
		if !replace {
			// for now we validate that after the update there will be just one extra config.
			for _, c := range configs {
				if c.Identifier != extraConfig.Identifier {
					return nil, ErrAlertmanagerMultipleExtraConfigsUnsupported.Build(errutil.TemplateData{Public: map[string]interface{}{"Identifier": c.Identifier}})
				}
			}
		}
		return []definitions.ExtraConfiguration{extraConfig}, nil
	}

	renamed, err := moa.modifyAndApplyExtraConfiguration(ctx, org, modifyFunc, dryRun)
	if err != nil {
		return definition.RenameResources{}, err
	}

	if dryRun {
		moa.logger.Info("Dry run: validated alertmanager configuration with extra config", "org", org, "identifier", extraConfig.Identifier)
	} else {
		moa.logger.Info("Applied alertmanager configuration with extra config", "org", org, "identifier", extraConfig.Identifier)
	}
	return renamed, nil
}

// DeleteExtraConfiguration deletes an ExtraConfiguration by its identifier while preserving the main AlertmanagerConfig.
func (moa *MultiOrgAlertmanager) DeleteExtraConfiguration(ctx context.Context, org int64, identifier string) error {
	modifyFunc := func(configs []definitions.ExtraConfiguration) ([]definitions.ExtraConfiguration, error) {
		filtered := make([]definitions.ExtraConfiguration, 0, len(configs))
		for _, ec := range configs {
			if ec.Identifier != identifier {
				filtered = append(filtered, ec)
			}
		}
		return filtered, nil
	}

	_, err := moa.modifyAndApplyExtraConfiguration(ctx, org, modifyFunc, false)
	return err
}

type provisioningStore interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	GetProvenancesByUIDs(ctx context.Context, org int64, resourceType string, uids []string) (map[string]models.Provenance, error)
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

func (moa *MultiOrgAlertmanager) mergeProvenance(ctx context.Context, config definitions.GettableUserConfig, org int64) (definitions.GettableUserConfig, error) {
	if config.AlertmanagerConfig.Route != nil {
		provenance, err := moa.ProvStore.GetProvenance(ctx, config.AlertmanagerConfig.Route, org)
		if err != nil {
			return definitions.GettableUserConfig{}, err
		}
		config.AlertmanagerConfig.Route.Provenance = definitions.Provenance(provenance)
	}

	cp := definitions.EmbeddedContactPoint{}
	cpProvs, err := moa.ProvStore.GetProvenances(ctx, org, cp.ResourceType())
	if err != nil {
		return definitions.GettableUserConfig{}, err
	}
	for _, receiver := range config.AlertmanagerConfig.Receivers {
		for _, contactPoint := range receiver.GrafanaManagedReceivers {
			if provenance, exists := cpProvs[contactPoint.UID]; exists {
				contactPoint.Provenance = definitions.Provenance(provenance)
			}
		}
	}

	tmpl := definitions.NotificationTemplate{}
	tmplProvs, err := moa.ProvStore.GetProvenances(ctx, org, tmpl.ResourceType())
	if err != nil {
		return definitions.GettableUserConfig{}, nil
	}
	config.TemplateFileProvenances = make(map[string]definitions.Provenance, len(tmplProvs))
	for key, provenance := range tmplProvs {
		config.TemplateFileProvenances[key] = definitions.Provenance(provenance)
	}

	mt := definitions.MuteTimeInterval{}
	mtProvs, err := moa.ProvStore.GetProvenances(ctx, org, mt.ResourceType())
	if err != nil {
		return definitions.GettableUserConfig{}, nil
	}
	config.AlertmanagerConfig.MuteTimeProvenances = make(map[string]definitions.Provenance, len(mtProvs))
	for key, provenance := range mtProvs {
		config.AlertmanagerConfig.MuteTimeProvenances[key] = definitions.Provenance(provenance)
	}

	return config, nil
}

// cleanPermissions will remove permissions for receivers that are no longer defined in the new configuration and
// set default permissions for new receivers.
func (moa *MultiOrgAlertmanager) cleanPermissions(ctx context.Context, orgID int64, previousConfig *models.AlertConfiguration, newReceiverNames sets.Set[string]) error {
	previousReceiverNames, err := extractReceiverNames(previousConfig.AlertmanagerConfiguration)
	if err != nil {
		return fmt.Errorf("failed to extract receiver names from previous configuration: %w", err)
	}

	var errs []error
	for receiverName := range previousReceiverNames.Difference(newReceiverNames) { // Deleted receivers.
		if err := moa.receiverResourcePermissions.DeleteResourcePermissions(ctx, orgID, legacy_storage.NameToUid(receiverName)); err != nil {
			errs = append(errs, fmt.Errorf("failed to delete permissions for receiver %s: %w", receiverName, err))
		}
	}

	for receiverName := range newReceiverNames.Difference(previousReceiverNames) { // Added receivers.
		moa.receiverResourcePermissions.SetDefaultPermissions(ctx, orgID, nil, legacy_storage.NameToUid(receiverName))
	}

	return errors.Join(errs...)
}

// extractReceiverNames extracts receiver names from the raw Alertmanager configuration. Unmarshalling ignores fields
// unrelated to receiver names, making it more resilient to invalid configurations.
func extractReceiverNames(rawConfig string) (sets.Set[string], error) {
	// Slimmed down version of the Alertmanager configuration to extract receiver names. This is more resilient to
	// invalid configurations when all we are interested in is the receiver names.
	type receiverUserConfig struct {
		AlertmanagerConfig struct {
			Receivers []struct {
				Name string `yaml:"name" json:"name"`
			} `yaml:"receivers,omitempty" json:"receivers,omitempty"`
		} `yaml:"alertmanager_config" json:"alertmanager_config"`
	}

	cfg := &receiverUserConfig{}
	if err := json.Unmarshal([]byte(rawConfig), cfg); err != nil {
		return nil, fmt.Errorf("unable to parse Alertmanager configuration: %w", err)
	}

	receiverNames := make(sets.Set[string], len(cfg.AlertmanagerConfig.Receivers))
	for _, r := range cfg.AlertmanagerConfig.Receivers {
		receiverNames[r.Name] = struct{}{}
	}

	return receiverNames, nil
}

// applyConfig is a helper method for preparing the db onfiguration and then applying it to the given alertmanager.
func (moa *MultiOrgAlertmanager) applyConfig(ctx context.Context, orgID int64, am Alertmanager, dbConfig *models.AlertConfiguration) (bool, error) {
	cfg, err := moa.PrepareConfig(ctx, orgID, dbConfig, LogInvalidReceivers)
	if err != nil {
		return false, fmt.Errorf("unable to prepare configuration: %w", err)
	}

	changed, err := am.ApplyConfig(ctx, cfg)
	if err != nil {
		return false, fmt.Errorf("failed to apply configuration: %w", err)
	}

	if changed {
		markConfigCmd := models.MarkConfigurationAsAppliedCmd{
			OrgID:             orgID,
			ConfigurationHash: dbConfig.ConfigurationHash,
		}
		err = moa.configStore.MarkConfigurationAsApplied(ctx, &markConfigCmd)
		if err != nil {
			return changed, fmt.Errorf("unable to mark configuration as applied: %w", err)
		}
	}
	return changed, nil
}

func newSaveAMConfigCmd(cfg string, orgID int64, isDefault bool) *models.SaveAlertmanagerConfigurationCmd {
	return &models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: cfg,
		Default:                   isDefault,
		ConfigurationVersion:      fmt.Sprintf("v%d", models.AlertConfigurationVersion),
		OrgID:                     orgID,
		LastApplied:               time.Now().UTC().Unix(),
	}
}

// saveAndApplyConfig saves a full legacy configuration blob to the database and applies the configuration to the Alertmanager.
// This should not be generally used but exists to facilitate operations that rely on the legacy blob config:
// - Create/Update ExtraConfig, whose storage currently piggybacks on PostableUserConfig.
// - Config version history revert, which will eventually need to be replaced with per-resource version history.
func (moa *MultiOrgAlertmanager) saveAndApplyConfig(ctx context.Context, orgID int64, am Alertmanager, cfg *definitions.PostableUserConfig) error {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	cfgToSave, err := json.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	return moa.saveAndApplyCmd(ctx, orgID, am, newSaveAMConfigCmd(string(cfgToSave), orgID, false), ErrorOnInvalidReceivers) // Rollback on error.
}

// saveAndApplyDefaultConfig is a helper method for resetting the configuration to default.
// Caller should lock the alertmanagersMtx.
func (moa *MultiOrgAlertmanager) saveAndApplyDefaultConfig(ctx context.Context, orgID int64, am Alertmanager) error {
	return moa.saveAndApplyCmd(ctx, orgID, am, newSaveAMConfigCmd(moa.settings.UnifiedAlerting.DefaultConfiguration, orgID, true), LogInvalidReceivers)
}

// saveAndApplyCmd is a helper method for saving and applying a configuration.
// Caller should lock the alertmanagersMtx.
func (moa *MultiOrgAlertmanager) saveAndApplyCmd(ctx context.Context, orgID int64, am Alertmanager, cmd *models.SaveAlertmanagerConfigurationCmd, onInvalid InvalidReceiversAction) error {
	return moa.configStore.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func(dbConfig models.AlertConfiguration) error {
		cfg, err := moa.PrepareConfig(ctx, orgID, &dbConfig, onInvalid)
		if err != nil {
			return err
		}
		_, err = am.ApplyConfig(ctx, cfg)
		return err
	})
}
