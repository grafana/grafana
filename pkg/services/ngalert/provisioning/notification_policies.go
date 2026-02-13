package provisioning

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/setting"
)

type NotificationPolicyService struct {
	configStore     alertmanagerConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
	settings        setting.UnifiedAlertingSettings
	validator       validation.ProvenanceStatusTransitionValidator
}

func NewNotificationPolicyService(am alertmanagerConfigStore, prov ProvisioningStore,
	xact TransactionManager, settings setting.UnifiedAlertingSettings, log log.Logger) *NotificationPolicyService {
	return &NotificationPolicyService{
		configStore:     am,
		provenanceStore: prov,
		xact:            xact,
		log:             log,
		settings:        settings,
		validator:       validation.ValidateProvenanceRelaxed,
	}
}

func (nps *NotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error) {
	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}

	if rev.Config.AlertmanagerConfig.Route == nil {
		return definitions.Route{}, "", fmt.Errorf("no route present in current alertmanager config")
	}

	provenance, err := nps.provenanceStore.GetProvenance(ctx, rev.Config.AlertmanagerConfig.Route, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}
	result := *rev.Config.AlertmanagerConfig.Route
	result.Provenance = definitions.Provenance(provenance)
	version := calculateRouteFingerprint(result)
	return result, version, nil
}

func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance, version string) (definitions.Route, string, error) {
	err := tree.Validate()
	if err != nil {
		return definitions.Route{}, "", models.MakeErrRouteInvalidFormat(err)
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}

	err = nps.checkOptimisticConcurrency(*revision.Config.AlertmanagerConfig.Route, p, version, "update")
	if err != nil {
		return definitions.Route{}, "", err
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, &tree, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}
	if err := nps.validator(storedProvenance, p); err != nil {
		return definitions.Route{}, "", err
	}

	if err := revision.ValidateRoute(tree); err != nil {
		return definitions.Route{}, "", models.MakeErrRouteInvalidFormat(err)
	}

	revision.Config.AlertmanagerConfig.Route = &tree

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		if errors.Is(err, definition.ErrSubtreeMatchersConflict) {
			// TODO temporarily get the conflicting matchers
			return definitions.Route{}, "", models.MakeErrRouteConflictingMatchers(fmt.Sprintf("%s", revision.Config.ExtraConfigs[0].MergeMatchers))
		}
		nps.log.Warn("Unable to validate the combined routing tree because of an error during merging. This could be a sign of broken external configuration. Skipping", "error", err)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetProvenance(ctx, &tree, orgID, p)
	})
	if err != nil {
		return definitions.Route{}, "", err
	}
	return tree, calculateRouteFingerprint(tree), nil
}

func (nps *NotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64, provenance models.Provenance) (definitions.Route, error) {
	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, &definitions.Route{}, orgID)
	if err != nil {
		return definitions.Route{}, err
	}
	if err := nps.validator(storedProvenance, provenance); err != nil {
		return definitions.Route{}, err
	}

	defaultCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
	if err != nil {
		nps.log.Error("Failed to parse default alertmanager config: %w", err)
		return definitions.Route{}, fmt.Errorf("failed to parse default alertmanager config: %w", err)
	}
	route := defaultCfg.AlertmanagerConfig.Route

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, err
	}

	if _, err := revision.ResetUserDefinedRoute(defaultCfg); err != nil {
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

func calculateRouteFingerprint(route definitions.Route) string {
	return legacy_storage.CalculateRouteFingerprint(route)
}

func (nps *NotificationPolicyService) checkOptimisticConcurrency(current definitions.Route, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			nps.log.Debug("ignoring optimistic concurrency check because version was not provided", "operation", action)
		}
		return nil
	}
	currentVersion := calculateRouteFingerprint(current)
	if currentVersion != desiredVersion {
		return ErrVersionConflict.Errorf("provided version %s of routing tree does not match current version %s", desiredVersion, currentVersion)
	}
	return nil
}
