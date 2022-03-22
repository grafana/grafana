package services

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AMStore is a store of Alertmanager configurations.
type AMConfigStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error
	SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

// ProvisioningStore is a store of provisioning data for arbitrary objects.
type ProvisioningStore interface {
	GetProvenance(ctx context.Context, o models.ProvisionableInOrg) (models.Provenance, error)
	SetProvenance(ctx context.Context, o models.ProvisionableInOrg, p models.Provenance) error
}
