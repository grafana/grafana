package routes

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/alerting/definition"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
	tracer          tracing.Tracer
}

func NewService(
	am alertmanagerConfigStore,
	prov routeProvenanceStore,
	xact transactionManager,
	settings setting.UnifiedAlertingSettings,
	features featuremgmt.FeatureToggles,
	log log.Logger,
	validator provenanceValidator,
	tracer tracing.Tracer,
) *Service {
	return &Service{
		configStore:     am,
		provenanceStore: prov,
		xact:            xact,
		log:             log,
		settings:        settings,
		FeatureToggles:  features,
		validator:       validator,
		tracer:          tracer,
	}
}

func (nps *Service) GetManagedRoute(ctx context.Context, orgID int64, name string) (legacy_storage.ManagedRoute, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.get", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("query_name", name),
		attribute.Bool("managed_routes_enabled", nps.managedRoutesEnabled()),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()

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
		// Check if this is referring to the imported config.
		if nps.includeImported() {
			route = nps.getImportedRoute(ctx, span, rev)
		}
		if route == nil {
			return legacy_storage.ManagedRoute{}, models.ErrRouteNotFound.Errorf("route %q not found", name)
		}
	}

	span.AddEvent("Loaded route", trace.WithAttributes(
		attribute.String("concurrency_token", rev.ConcurrencyToken),
	))

	provenance, err := nps.provenanceStore.GetProvenance(ctx, route, orgID)
	if err != nil {
		return legacy_storage.ManagedRoute{}, err
	}
	route.Provenance = provenance

	return *route, nil
}

func (nps *Service) GetManagedRoutes(ctx context.Context, orgID int64) (legacy_storage.ManagedRoutes, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.getMany", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.Bool("managed_routes_enabled", nps.managedRoutesEnabled()),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()

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

	if nps.managedRoutesEnabled() && nps.includeImported() {
		importedRoute := nps.getImportedRoute(ctx, span, rev)
		if importedRoute != nil {
			// This shouldn't happen under normal circumstances as we guard during create. However, if it happens, we error for now.
			// When UIDs are introduced to managed routes, we can choose to de-duplicate the name as rules will reference the route by UID, not name.
			if exists := managedRoutes.Contains(importedRoute.Name); exists {
				nps.log.FromContext(ctx).Warn("Imported route name conflicts with existing managed route. Skipping imported route.", "route_name", importedRoute.Name)
				span.AddEvent("Skipped imported route due to name conflict", trace.WithAttributes(
					attribute.String("route_name", importedRoute.Name),
				))
			} else {
				managedRoutes = append(managedRoutes, importedRoute)
			}
		}
	}

	span.AddEvent("Loaded routes", trace.WithAttributes(
		attribute.String("concurrency_token", rev.ConcurrencyToken),
		attribute.Int("count", len(managedRoutes)),
	))

	managedRoutes.Sort()
	return managedRoutes, nil
}

func (nps *Service) UpdateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p models.Provenance, version string) (*legacy_storage.ManagedRoute, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.update", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("route_name", name),
		attribute.String("route_version", version),
		attribute.Bool("managed_routes_enabled", nps.managedRoutesEnabled()),
		attribute.Bool("include_imported", nps.includeImported()),
	))
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
		// Check if this is referring to the imported config to return a better error message.
		if nps.includeImported() {
			if importedRoute := nps.getImportedRoute(ctx, span, revision); importedRoute != nil && importedRoute.Name == name {
				return nil, models.MakeErrRouteOrigin(name, "update")
			}
		}
		return nil, models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	span.AddEvent("Loaded current route", trace.WithAttributes(
		attribute.String("concurrency_token", revision.ConcurrencyToken),
		attribute.String("route_name", name),
		attribute.String("route_version", existing.Version),
	))

	err = nps.checkOptimisticConcurrency(existing, version)
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
		nps.log.FromContext(ctx).Warn("Unable to validate the combined routing tree because of an error during merging. This could be a sign of broken external configuration. Skipping", "error", err)
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
	span.AddEvent("Route updated", trace.WithAttributes(
		attribute.String("version", updated.Version),
	))
	nps.log.FromContext(ctx).Info("Updated route", "name", name, "oldVersion", existing.Version, "newVersion", updated.Version)
	return updated, nil
}

func (nps *Service) DeleteManagedRoute(ctx context.Context, orgID int64, name string, p models.Provenance, version string) error {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.delete", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("route_name", name),
		attribute.String("route_version", version),
		attribute.Bool("managed_routes_enabled", nps.managedRoutesEnabled()),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()

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
		// Check if this is referring to the imported config to return a better error message.
		if nps.includeImported() {
			if importedRoute := nps.getImportedRoute(ctx, span, revision); importedRoute != nil && importedRoute.Name == name {
				return models.MakeErrRouteOrigin(name, "delete")
			}
		}
		return models.ErrRouteNotFound.Errorf("route %q not found", name)
	}

	// Optimistic concurrency is optional for delete operations, but we still check it if a version is provided.
	if version != "" {
		err = nps.checkOptimisticConcurrency(existing, version)
		if err != nil {
			return err
		}
	} else {
		nps.log.FromContext(ctx).Debug("Ignoring optimistic concurrency check because version was not provided", "operation", "delete")
	}

	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, existing, orgID)
	if err != nil {
		return err
	}
	if err := nps.validator(storedProvenance, p); err != nil {
		return err
	}

	action := "Deleted"
	if name == legacy_storage.UserDefinedRoutingTreeName {
		defaultCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
		if err != nil {
			return fmt.Errorf("failed to parse default alertmanager config: %w", err)
		}

		_, err = revision.ResetUserDefinedRoute(defaultCfg)
		if err != nil {
			return err
		}
		action = "Reset"
	} else {
		revision.DeleteManagedRoute(name)
	}

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		return fmt.Errorf("new routing tree is not compatible with extra configuration: %w", err)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.DeleteProvenance(ctx, existing, orgID)
	})
	if err != nil {
		return err
	}
	span.AddEvent(fmt.Sprintf("%s route", action), trace.WithAttributes(
		attribute.String("concurrency_token", revision.ConcurrencyToken),
	))
	nps.log.FromContext(ctx).Info(fmt.Sprintf("%s route", action), "name", name)
	return nil
}

func (nps *Service) CreateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p models.Provenance) (*legacy_storage.ManagedRoute, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.create", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("route_name", name),
		attribute.Bool("managed_routes_enabled", nps.managedRoutesEnabled()),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()
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

	// Check if this conflicts with an imported config.
	// When UIDs are introduced to managed routes, we can choose to de-duplicate the name as rules will reference the route by UID, not name.
	if nps.includeImported() {
		if importedRoute := nps.getImportedRoute(ctx, span, revision); importedRoute != nil && importedRoute.Name == name {
			return nil, models.ErrRouteExists.Errorf("cannot create a managed route with the name %q, as it conflicts with an imported route", name)
		}
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
	span.AddEvent("Route created", trace.WithAttributes(
		attribute.String("version", created.Version),
	))
	nps.log.FromContext(ctx).Info("Created route", "name", name, "version", created.Version)
	return created, nil
}

// checkOptimisticConcurrency checks if the existing routes's version matches the desired version.
func (nps *Service) checkOptimisticConcurrency(current *legacy_storage.ManagedRoute, desiredVersion string) error {
	if current.Version != desiredVersion {
		return models.MakeErrRouteVersionConflict(current.Name, current.Version, desiredVersion)
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

func (nps *Service) getImportedRoute(ctx context.Context, span trace.Span, revision *legacy_storage.ConfigRevision) *legacy_storage.ManagedRoute {
	var result *legacy_storage.ManagedRoute
	imported, err := revision.Imported()
	if err == nil {
		result, err = imported.GetManagedRoute()
	}
	if err != nil {
		nps.log.FromContext(ctx).Warn("Unable to include imported route. Skipping", "err", err)
		span.RecordError(err, trace.WithAttributes(
			attribute.String("concurrency_token", revision.ConcurrencyToken),
		))
		return nil
	} else if result != nil {
		span.AddEvent("Loaded imported route", trace.WithAttributes(
			attribute.String("concurrency_token", revision.ConcurrencyToken),
		))
	}

	return result
}

func (nps *Service) managedRoutesEnabled() bool {
	if nps.FeatureToggles == nil {
		return false
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	return nps.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingMultiplePolicies)
}

func (nps *Service) includeImported() bool {
	if nps.FeatureToggles == nil {
		return false
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	return nps.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI)
}
