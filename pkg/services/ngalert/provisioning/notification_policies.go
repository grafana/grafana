package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type NotificationPolicyService struct {
	amStore         AMConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
}

func NewNotificationPolicyService(am AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *NotificationPolicyService {
	return &NotificationPolicyService{
		amStore:         am,
		provenanceStore: prov,
		xact:            xact,
		log:             log,
	}
}

// TODO: move to Swagger codegen
type EmbeddedRoutingTree struct {
	definitions.Route
	Provenance models.Provenance
}

func (nps *NotificationPolicyService) GetAMConfigStore() AMConfigStore {
	return nps.amStore
}

func (nps *NotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (EmbeddedRoutingTree, error) {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := nps.amStore.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return EmbeddedRoutingTree{}, err
	}

	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return EmbeddedRoutingTree{}, err
	}

	if cfg.AlertmanagerConfig.Config.Route == nil {
		return EmbeddedRoutingTree{}, fmt.Errorf("no route present in current alertmanager config")
	}

	adapter := provenanceOrgAdapter{
		inner: cfg.AlertmanagerConfig.Route,
		orgID: orgID,
	}
	provenance, err := nps.provenanceStore.GetProvenance(ctx, adapter)
	if err != nil {
		return EmbeddedRoutingTree{}, err
	}

	result := EmbeddedRoutingTree{
		Route:      *cfg.AlertmanagerConfig.Route,
		Provenance: provenance,
	}

	return result, nil
}

func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance) error {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := nps.amStore.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return err
	}

	concurrencyToken := q.Result.ConfigurationHash
	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return err
	}

	cfg.AlertmanagerConfig.Config.Route = &tree

	serialized, err := SerializeAlertmanagerConfig(*cfg)
	if err != nil {
		return err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      q.Result.ConfigurationVersion,
		FetchedConfigurationHash:  concurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = nps.amStore.UpdateAlertmanagerConfiguration(ctx, &cmd)
		if err != nil {
			return err
		}
		adapter := provenanceOrgAdapter{
			inner: &tree,
			orgID: orgID,
		}
		err = nps.provenanceStore.SetProvenance(ctx, adapter, p)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

type provenanceOrgAdapter struct {
	inner models.ProvisionableInOrg
	orgID int64
}

func (a provenanceOrgAdapter) ResourceType() string {
	return a.inner.ResourceType()
}

func (a provenanceOrgAdapter) ResourceID() string {
	return a.inner.ResourceID()
}

func (a provenanceOrgAdapter) ResourceOrgID() int64 {
	return a.orgID
}
