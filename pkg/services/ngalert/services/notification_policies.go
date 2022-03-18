package services

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
	log             log.Logger
}

func NewNotificationPolicyService(am AMConfigStore, prov ProvisioningStore, log log.Logger) *NotificationPolicyService {
	return &NotificationPolicyService{
		amStore:         am,
		provenanceStore: prov,
		log:             log,
	}
}

func (nps *NotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := nps.amStore.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return definitions.Route{}, err
	}

	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return definitions.Route{}, err
	}

	if cfg.AlertmanagerConfig.Config.Route == nil {
		return definitions.Route{}, fmt.Errorf("no route present in current alertmanager config")
	}

	return *cfg.AlertmanagerConfig.Route, nil
}

func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route) (definitions.Route, error) {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := nps.amStore.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return definitions.Route{}, err
	}

	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return definitions.Route{}, err
	}

	cfg.AlertmanagerConfig.Config.Route = &tree

	serialized, err := SerializeAlertmanagerConfig(*cfg)
	if err != nil {
		return definitions.Route{}, err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      q.Result.ConfigurationVersion,
		Default:                   false,
		OrgID:                     orgID,
	}
	err = nps.amStore.SaveAlertmanagerConfiguration(ctx, &cmd)
	if err != nil {
		return definitions.Route{}, err
	}

	return tree, nil
}
