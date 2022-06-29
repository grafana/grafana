package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type NotificationPolicyService struct {
	amStore         AMConfigStore
	provenanceStore ProvisioningStore
	contactPoints   ContactPointProvider
	xact            TransactionManager
	log             log.Logger
}

type ContactPointProvider interface {
	GetContactPoints(ctx context.Context, orgID int64) ([]apimodels.EmbeddedContactPoint, error)
}

func NewNotificationPolicyService(am AMConfigStore, prov ProvisioningStore,
	cps ContactPointProvider, xact TransactionManager,
	log log.Logger) *NotificationPolicyService {
	return &NotificationPolicyService{
		amStore:         am,
		provenanceStore: prov,
		contactPoints:   cps,
		xact:            xact,
		log:             log,
	}
}

func (nps *NotificationPolicyService) GetAMConfigStore() AMConfigStore {
	return nps.amStore
}

func (nps *NotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := nps.amStore.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return definitions.Route{}, err
	}

	cfg, err := deserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return definitions.Route{}, err
	}

	if cfg.AlertmanagerConfig.Config.Route == nil {
		return definitions.Route{}, fmt.Errorf("no route present in current alertmanager config")
	}

	provenance, err := nps.provenanceStore.GetProvenance(ctx, cfg.AlertmanagerConfig.Route, orgID)
	if err != nil {
		return definitions.Route{}, err
	}

	result := *cfg.AlertmanagerConfig.Route
	result.Provenance = provenance

	return result, nil
}

func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance) error {
	err := tree.Validate()
	if err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}
	receivers, err := nps.receivers(ctx, orgID)
	err = tree.ValidateReceivers(receivers)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}
	revision, err := getLastConfiguration(ctx, orgID, nps.amStore)
	if err != nil {
		return err
	}

	revision.cfg.AlertmanagerConfig.Config.Route = &tree

	serialized, err := serializeAlertmanagerConfig(*revision.cfg)
	if err != nil {
		return err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      revision.version,
		FetchedConfigurationHash:  revision.concurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = nps.amStore.UpdateAlertmanagerConfiguration(ctx, &cmd)
		if err != nil {
			return err
		}
		err = nps.provenanceStore.SetProvenance(ctx, &tree, orgID, p)
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

func (nps *NotificationPolicyService) receivers(ctx context.Context, orgID int64) (map[string]struct{}, error) {
	receivers := map[string]struct{}{}
	cps, err := nps.contactPoints.GetContactPoints(ctx, orgID)
	if err != nil {
		return receivers, err
	}
	for _, cp := range cps {
		receivers[cp.Name] = struct{}{}
	}
	return receivers, nil
}
