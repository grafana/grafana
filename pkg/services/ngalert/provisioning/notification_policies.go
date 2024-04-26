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
	configStore     *alertmanagerConfigStoreImpl
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
	settings        setting.UnifiedAlertingSettings
}

func NewNotificationPolicyService(am AMConfigStore, prov ProvisioningStore,
	xact TransactionManager, settings setting.UnifiedAlertingSettings, log log.Logger) *NotificationPolicyService {
	return &NotificationPolicyService{
		configStore:     &alertmanagerConfigStoreImpl{store: am},
		provenanceStore: prov,
		xact:            xact,
		log:             log,
		settings:        settings,
	}
}

func (nps *NotificationPolicyService) GetAMConfigStore() AMConfigStore {
	return nps.configStore.store
}

func (nps *NotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, err
	}

	if rev.cfg.AlertmanagerConfig.Config.Route == nil {
		return definitions.Route{}, fmt.Errorf("no route present in current alertmanager config")
	}

	provenance, err := nps.provenanceStore.GetProvenance(ctx, rev.cfg.AlertmanagerConfig.Route, orgID)
	if err != nil {
		return definitions.Route{}, err
	}

	result := *rev.cfg.AlertmanagerConfig.Route
	result.Provenance = definitions.Provenance(provenance)

	return result, nil
}

func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance) error {
	err := tree.Validate()
	if err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	receivers, err := nps.receiversToMap(revision.cfg.AlertmanagerConfig.Receivers)
	if err != nil {
		return err
	}

	receivers[""] = struct{}{} // Allow empty receiver (inheriting from parent)
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

	return nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetProvenance(ctx, &tree, orgID, p)
	})
}

func (nps *NotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	defaultCfg, err := deserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
	if err != nil {
		nps.log.Error("Failed to parse default alertmanager config: %w", err)
		return definitions.Route{}, fmt.Errorf("failed to parse default alertmanager config: %w", err)
	}
	route := defaultCfg.AlertmanagerConfig.Route

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, err
	}
	revision.cfg.AlertmanagerConfig.Config.Route = route
	err = nps.ensureDefaultReceiverExists(revision.cfg, defaultCfg)
	if err != nil {
		return definitions.Route{}, err
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.DeleteProvenance(ctx, route, orgID)
	})

	if err != nil {
		return definitions.Route{}, nil
	} // TODO should be error?

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
