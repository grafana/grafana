package routes

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/setting"
)

type routeProvenanceStore interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

type transactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error)
	Save(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64) error
}

type provenanceValidator func(from, to models.Provenance) error

type Service struct {
	configStore     alertmanagerConfigStore
	provenanceStore routeProvenanceStore
	xact            transactionManager
	log             log.Logger
	settings        setting.UnifiedAlertingSettings
	validator       provenanceValidator
	FeatureToggles  featuremgmt.FeatureToggles
}

func NewService(
	am alertmanagerConfigStore,
	prov routeProvenanceStore,
	xact transactionManager,
	settings setting.UnifiedAlertingSettings,
	features featuremgmt.FeatureToggles,
	log log.Logger,
	validator provenanceValidator,
) *Service {
	return &Service{
		configStore:     am,
		provenanceStore: prov,
		xact:            xact,
		log:             log,
		settings:        settings,
		FeatureToggles:  features,
		validator:       validator,
	}
}

func (nps *Service) GetManagedRoute(ctx context.Context, orgID int64, name string) (legacy_storage.ManagedRoute, error) {
	// Backwards compatibility when managed routes FF is disabled. Only allow the default route.
	if !nps.managedRoutesEnabled() && name != legacy_storage.UserDefinedRoutingTreeName {
		return legacy_storage.ManagedRoute{}, models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return legacy_storage.ManagedRoute{}, err
	}

	route := rev.GetManagedRoute(name)
	if route == nil {
		return legacy_storage.ManagedRoute{}, models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	provenance, err := nps.provenanceStore.GetProvenance(ctx, route, orgID)
	if err != nil {
		return legacy_storage.ManagedRoute{}, err
	}
	route.Provenance = provenance

	return *route, nil
}

func (nps *Service) GetManagedRoutes(ctx context.Context, orgID int64) (legacy_storage.ManagedRoutes, error) {
	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	provenances, err := nps.provenanceStore.GetProvenances(ctx, orgID, (&legacy_storage.ManagedRoute{}).ResourceType())
	if err != nil {
		return nil, err
	}

	// Backwards compatibility when managed routes FF is disabled. Don't include any custom managed routes.
	managedRoutes := rev.GetManagedRoutes(nps.managedRoutesEnabled())
	for _, mr := range managedRoutes {
		provenance, ok := provenances[mr.ResourceID()]
		if !ok {
			provenance = models.ProvenanceNone
		}
		mr.Provenance = provenance
	}
	managedRoutes.Sort()
	return managedRoutes, nil
}

func (nps *Service) UpdateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p models.Provenance, version string) (*legacy_storage.ManagedRoute, error) {
	// Backwards compatibility when managed routes FF is disabled. Only allow the default route.
	if !nps.managedRoutesEnabled() && name != legacy_storage.UserDefinedRoutingTreeName {
		return nil, models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	err := subtree.Validate()
	if err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	existing := revision.GetManagedRoute(name)
	if existing == nil {
		return nil, models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	err = nps.checkOptimisticConcurrency(existing, p, version, "update")
	if err != nil {
		return nil, err
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, existing, orgID)
	if err != nil {
		return nil, err
	}
	if err := nps.validator(storedProvenance, p); err != nil {
		return nil, err
	}

	updated, err := revision.UpdateNamedRoute(name, subtree)
	if err != nil {
		return nil, err
	}
	updated.Provenance = storedProvenance

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		if errors.Is(err, definition.ErrSubtreeMatchersConflict) {
			// TODO temporarily get the conflicting matchers
			return nil, models.MakeErrRouteConflictingMatchers(fmt.Sprintf("%s", revision.Config.ExtraConfigs[0].MergeMatchers))
		}
		nps.log.Warn("Unable to validate the combined routing tree because of an error during merging. This could be a sign of broken external configuration. Skipping", "error", err)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetProvenance(ctx, updated, orgID, p)
	})
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (nps *Service) DeleteManagedRoute(ctx context.Context, orgID int64, name string, p models.Provenance, version string) error {
	// Backwards compatibility when managed routes FF is disabled. Only allow the default route.
	if !nps.managedRoutesEnabled() && name != legacy_storage.UserDefinedRoutingTreeName {
		return models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	existing := revision.GetManagedRoute(name)
	if existing == nil {
		return models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	err = nps.checkOptimisticConcurrency(existing, p, version, "delete")
	if err != nil {
		return err
	}

	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, existing, orgID)
	if err != nil {
		return err
	}
	if err := nps.validator(storedProvenance, p); err != nil {
		return err
	}

	if name == legacy_storage.UserDefinedRoutingTreeName {
		defaultCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
		if err != nil {
			return fmt.Errorf("failed to parse default alertmanager config: %w", err)
		}

		_, err = revision.ResetUserDefinedRoute(defaultCfg)
		if err != nil {
			return err
		}
	} else {
		revision.DeleteManagedRoute(name)
	}

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		return fmt.Errorf("new routing tree is not compatible with extra configuration: %w", err)
	}

	return nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.DeleteProvenance(ctx, existing, orgID)
	})
}

func (nps *Service) CreateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p models.Provenance) (*legacy_storage.ManagedRoute, error) {
	// Backwards compatibility when managed routes FF is disabled. This is not allowed.
	if !nps.managedRoutesEnabled() {
		return nil, models.ErrMultipleRoutesNotSupported.Errorf("")
	}

	err := subtree.Validate()
	if err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	created, err := revision.CreateManagedRoute(name, subtree)
	if err != nil {
		return nil, err
	}

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		return nil, fmt.Errorf("new routing tree is not compatible with extra configuration: %w", err)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetProvenance(ctx, created, orgID, p)
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (nps *Service) checkOptimisticConcurrency(current *legacy_storage.ManagedRoute, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			nps.log.Debug("ignoring optimistic concurrency check because version was not provided", "operation", action)
		}
		return nil
	}
	if current.Version != desiredVersion {
		return models.ErrVersionConflict.Errorf("provided version %s of routing tree does not match current version %s", desiredVersion, current.Version)
	}
	return nil
}

func (nps *Service) ReceiverUseByName(_ context.Context, rev *legacy_storage.ConfigRevision) map[string]int {
	return rev.ReceiverUseByName(nps.managedRoutesEnabled())
}

func (nps *Service) ReceiverNameUsedByRoutes(_ context.Context, rev *legacy_storage.ConfigRevision, name string) bool {
	return rev.ReceiverNameUsedByRoutes(name, nps.managedRoutesEnabled())
}

func (nps *Service) RenameReceiverInRoutes(_ context.Context, rev *legacy_storage.ConfigRevision, oldName, newName string) map[*definitions.Route]int {
	return rev.RenameReceiverInRoutes(oldName, newName, nps.managedRoutesEnabled())
}

func (nps *Service) RenameTimeIntervalInRoutes(_ context.Context, rev *legacy_storage.ConfigRevision, oldName string, newName string) map[*definitions.Route]int {
	return rev.RenameTimeIntervalInRoutes(oldName, newName, nps.managedRoutesEnabled())
}

func (nps *Service) managedRoutesEnabled() bool {
	if nps.FeatureToggles == nil {
		return false
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	return nps.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingMultiplePolicies)
}
