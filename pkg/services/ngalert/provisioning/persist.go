package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AMStore is a store of Alertmanager configurations.
type AMConfigStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

// ProvisioningStore is a store of provisioning data for arbitrary objects.
type ProvisioningStore interface {
	GetProvenance(ctx context.Context, o models.Provisionable) (models.Provenance, error)
	GetProvenances(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error)
	SetProvenance(ctx context.Context, o models.Provisionable, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable) error
}

// TransactionManager represents the ability to issue and close transactions through contexts.
type TransactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

type ProvenanceOrgAdapter struct {
	Inner models.ProvisionableInOrg
	OrgID int64
}

func (a ProvenanceOrgAdapter) ResourceType() string {
	return a.Inner.ResourceType()
}

func (a ProvenanceOrgAdapter) ResourceID() string {
	return a.Inner.ResourceID()
}

func (a ProvenanceOrgAdapter) ResourceOrgID() int64 {
	return a.OrgID
}
