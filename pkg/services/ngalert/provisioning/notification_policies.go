package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

type NotificationPolicyService struct {
	amStore         AMConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
	settings        setting.UnifiedAlertingSettings
}

func NewNotificationPolicyService(am AMConfigStore, prov ProvisioningStore,
	xact TransactionManager, settings setting.UnifiedAlertingSettings, log log.Logger) *NotificationPolicyService {
	return &NotificationPolicyService{
		amStore:         am,
		provenanceStore: prov,
		xact:            xact,
		log:             log,
		settings:        settings,
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
	result.Provenance = definitions.Provenance(provenance)

	return result, nil
}

func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance) error {
	err := tree.Validate()
	if err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	revision, err := getLastConfiguration(ctx, orgID, nps.amStore)
	if err != nil {
		return err
	}

	receivers, err := nps.receiversToMap(revision.cfg.AlertmanagerConfig.Receivers)
	if err != nil {
		return err
	}

	err = tree.ValidateReceivers(receivers)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	muteTimes := map[string]struct{}{}
	for _, mt := range revision.cfg.AlertmanagerConfig.MuteTimeIntervals {
		muteTimes[mt.Name] = struct{}{}
	}
	err = tree.ValidateMuteTimes(muteTimes)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
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
		err = PersistConfig(ctx, nps.amStore, &cmd)
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

func (nps *NotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	defaultCfg, err := deserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
	if err != nil {
		nps.log.Error("failed to parse default alertmanager config: %w", err)
		return definitions.Route{}, fmt.Errorf("failed to parse default alertmanager config: %w", err)
	}
	route := defaultCfg.AlertmanagerConfig.Route

	revision, err := getLastConfiguration(ctx, orgID, nps.amStore)
	if err != nil {
		return definitions.Route{}, err
	}
	revision.cfg.AlertmanagerConfig.Config.Route = route
	err = nps.ensureDefaultReceiverExists(revision.cfg, defaultCfg)
	if err != nil {
		return definitions.Route{}, err
	}

	serialized, err := serializeAlertmanagerConfig(*revision.cfg)
	if err != nil {
		return definitions.Route{}, err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      revision.version,
		FetchedConfigurationHash:  revision.concurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		err := PersistConfig(ctx, nps.amStore, &cmd)
		if err != nil {
			return err
		}
		err = nps.provenanceStore.DeleteProvenance(ctx, route, orgID)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return definitions.Route{}, nil
	}

	return *route, nil
}

func (nps *NotificationPolicyService) receiversToMap(records []*definitions.PostableApiReceiver) (map[string]struct{}, error) {
	receivers := map[string]struct{}{}
	for _, receiver := range records {
		receivers[receiver.Name] = struct{}{}
	}
	return receivers, nil
}

func (nps *NotificationPolicyService) ensureDefaultReceiverExists(cfg *definitions.PostableUserConfig, defaultCfg *definitions.PostableUserConfig) error {
	defaultRcv := cfg.AlertmanagerConfig.Route.Receiver

	for _, rcv := range cfg.AlertmanagerConfig.Receivers {
		if rcv.Name == defaultRcv {
			return nil
		}
	}

	for _, rcv := range defaultCfg.AlertmanagerConfig.Receivers {
		if rcv.Name == defaultRcv {
			cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers, rcv)
			return nil
		}
	}

	nps.log.Error("Grafana Alerting has been configured with a default configuration that is internally inconsistent! The default configuration's notification policy must have a corresponding receiver.")
	return fmt.Errorf("inconsistent default configuration")
}
