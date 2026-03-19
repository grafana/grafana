package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AlertmanagerType represents which alertmanager(s) to use.
type AlertmanagerType string

const (
	// AlertmanagerTypeInternal uses only the internal/built-in Grafana Alertmanager.
	AlertmanagerTypeInternal AlertmanagerType = "internal"
	// AlertmanagerTypeExternal uses only an external Alertmanager (e.g. Mimir, Cortex).
	AlertmanagerTypeExternal AlertmanagerType = "external"
	// AlertmanagerTypeBoth uses both internal and external Alertmanagers.
	AlertmanagerTypeBoth AlertmanagerType = "both"
)

// AdminConfig holds the Alertmanager admin configuration for an org.
type AdminConfig struct {
	// OrgID is the organisation this config belongs to.
	OrgID int64
	// AlertmanagersChoice controls which alertmanager(s) receive alerts.
	AlertmanagersChoice AlertmanagerType
	// ExternalAlertmanagers is a list of external AM URLs.
	ExternalAlertmanagers []string
}

// AlertmanagerAdminConfigStore is the persistence layer for AdminConfig.
//
//go:generate mockery --name AlertmanagerAdminConfigStore --structname MockAlertmanagerAdminConfigStore --inpackage --filename alertmanager_admin_config_store_mock.go --with-expecter
type AlertmanagerAdminConfigStore interface {
	// GetAdminConfiguration returns the stored admin config for the given org.
	// Returns (nil, nil) when no config exists yet.
	GetAdminConfiguration(ctx context.Context, orgID int64) (*AdminConfig, error)
	// SaveAdminConfiguration persists the admin config for the given org.
	SaveAdminConfiguration(ctx context.Context, config AdminConfig) error
	// DeleteAdminConfiguration removes the admin config for the given org.
	DeleteAdminConfiguration(ctx context.Context, orgID int64) error
}

// AlertmanagerAdminConfigService allows provisioning of external Alertmanager configuration
// (i.e. which alertmanager(s) should receive alerts) without requiring UI interaction.
//
// This resolves GitHub issue #120674 — External Only Alertmanager provisioning.
type AlertmanagerAdminConfigService struct {
	store           AlertmanagerAdminConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
}

// NewAlertmanagerAdminConfigService creates a new AlertmanagerAdminConfigService.
func NewAlertmanagerAdminConfigService(
	store AlertmanagerAdminConfigStore,
	provenanceStore ProvisioningStore,
	xact TransactionManager,
	log log.Logger,
) *AlertmanagerAdminConfigService {
	return &AlertmanagerAdminConfigService{
		store:           store,
		provenanceStore: provenanceStore,
		xact:            xact,
		log:             log,
	}
}

// GetAdminConfiguration retrieves the current Alertmanager admin config for the org.
// If no config has been set, returns a default (internal-only) config with ProvenanceNone.
func (svc *AlertmanagerAdminConfigService) GetAdminConfiguration(
	ctx context.Context,
	orgID int64,
) (AdminConfig, models.Provenance, error) {
	cfg, err := svc.store.GetAdminConfiguration(ctx, orgID)
	if err != nil {
		return AdminConfig{}, models.ProvenanceNone, fmt.Errorf("failed to get admin config: %w", err)
	}

	if cfg == nil {
		// Return sensible default: internal alertmanager, no provenance.
		return AdminConfig{
			OrgID:               orgID,
			AlertmanagersChoice: AlertmanagerTypeInternal,
		}, models.ProvenanceNone, nil
	}

	provenance, err := svc.provenanceStore.GetProvenance(ctx, cfg, orgID)
	if err != nil {
		return AdminConfig{}, models.ProvenanceNone, fmt.Errorf("failed to get admin config provenance: %w", err)
	}

	return *cfg, provenance, nil
}

// SaveAdminConfiguration persists the Alertmanager admin config for the org.
//
// It validates the config, checks provenance transitions, and saves atomically.
// Use provenance = models.ProvenanceFile when calling from file-based provisioning
// and provenance = models.ProvenanceAPI when calling from the HTTP API.
func (svc *AlertmanagerAdminConfigService) SaveAdminConfiguration(
	ctx context.Context,
	orgID int64,
	config AdminConfig,
	provenance models.Provenance,
) error {
	if err := validateAdminConfig(config); err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	config.OrgID = orgID

	// Check provenance transition is valid.
	existing, existingProvenance, err := svc.GetAdminConfiguration(ctx, orgID)
	if err != nil {
		return err
	}

	if err := validateProvenanceTransition(existingProvenance, provenance, existing, config); err != nil {
		return err
	}

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.store.SaveAdminConfiguration(ctx, config); err != nil {
			return fmt.Errorf("failed to save admin config: %w", err)
		}
		if err := svc.provenanceStore.SetProvenance(ctx, &config, orgID, provenance); err != nil {
			return fmt.Errorf("failed to set admin config provenance: %w", err)
		}
		svc.log.Info("Saved Alertmanager admin configuration",
			"org", orgID,
			"choice", config.AlertmanagersChoice,
			"provenance", provenance,
			"externalCount", len(config.ExternalAlertmanagers),
		)
		return nil
	})
}

// DeleteAdminConfiguration removes the admin config for the org, reverting to the default
// (internal alertmanager only). It checks that the stored provenance allows deletion.
func (svc *AlertmanagerAdminConfigService) DeleteAdminConfiguration(
	ctx context.Context,
	orgID int64,
	provenance models.Provenance,
) error {
	_, storedProvenance, err := svc.GetAdminConfiguration(ctx, orgID)
	if err != nil {
		return err
	}

	if storedProvenance != models.ProvenanceNone && storedProvenance != provenance {
		return fmt.Errorf(
			"cannot delete admin config with provenance '%s' using '%s': use the same provisioning method that created it",
			storedProvenance, provenance,
		)
	}

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.store.DeleteAdminConfiguration(ctx, orgID); err != nil {
			return fmt.Errorf("failed to delete admin config: %w", err)
		}
		sentinel := &AdminConfig{OrgID: orgID}
		if err := svc.provenanceStore.DeleteProvenance(ctx, sentinel, orgID); err != nil {
			// Non-fatal: config is gone; just log.
			svc.log.Warn("Failed to delete admin config provenance record", "org", orgID, "error", err)
		}
		return nil
	})
}

// validateAdminConfig checks that the supplied AdminConfig is self-consistent.
func validateAdminConfig(cfg AdminConfig) error {
	switch cfg.AlertmanagersChoice {
	case AlertmanagerTypeInternal, AlertmanagerTypeBoth:
		// External URLs are optional for "both".
	case AlertmanagerTypeExternal:
		if len(cfg.ExternalAlertmanagers) == 0 {
			return fmt.Errorf(
				"at least one external Alertmanager URL must be provided when alertmanagersChoice is '%s'",
				AlertmanagerTypeExternal,
			)
		}
	default:
		return fmt.Errorf(
			"invalid alertmanagersChoice '%s': must be one of '%s', '%s', or '%s'",
			cfg.AlertmanagersChoice,
			AlertmanagerTypeInternal,
			AlertmanagerTypeExternal,
			AlertmanagerTypeBoth,
		)
	}
	return nil
}

// validateProvenanceTransition ensures we can overwrite an existing config with the new provenance.
func validateProvenanceTransition(
	storedProvenance, incomingProvenance models.Provenance,
	existing, incoming AdminConfig,
) error {
	// Same provenance: always allowed (idempotent writes).
	if storedProvenance == incomingProvenance {
		return nil
	}
	// No existing config: any provenance is fine.
	if storedProvenance == models.ProvenanceNone {
		return nil
	}
	// Reject attempts to overwrite a provisioned config with a different provenance.
	return fmt.Errorf(
		"cannot change admin config provenance from '%s' to '%s': "+
			"delete the existing config using the original provisioning method first",
		storedProvenance, incomingProvenance,
	)
}

// ResourceType implements models.Provisionable so AdminConfig can be stored in the provenance table.
func (c *AdminConfig) ResourceType() string {
	return "alertmanager-admin-config"
}

// ResourceID implements models.Provisionable.
// We use a fixed ID because there is at most one admin config per org.
func (c *AdminConfig) ResourceID() string {
	return "admin-config"
}

