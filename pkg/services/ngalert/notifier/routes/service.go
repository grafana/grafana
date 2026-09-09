package routes

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/setting"
)

type routeProvenanceStore interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
	GetManagerProperties(ctx context.Context, o models.Provisionable, org int64) (utils.ManagerProperties, error)
	GetAllManagerProperties(ctx context.Context, org int64, resourceType string) (map[string]utils.ManagerProperties, error)
	SetManagerProperties(ctx context.Context, o models.Provisionable, org int64, m utils.ManagerProperties) error
}

var errManagerMismatch = errutil.NewBase(errutil.StatusConflict, "alerting.managerMismatch").MustTemplate(
	"cannot {{ .Public.Operation }} with provided manager kind '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'",
	errutil.WithPublic("cannot {{ .Public.Operation }} with provided manager kind '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'"),
)

type transactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error)
	Save(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64) error
}

type routeAccessControl interface {
	FilterRead(ctx context.Context, user identity.Requester, routes ...*legacy_storage.ManagedRoute) ([]*legacy_storage.ManagedRoute, error)
	AuthorizeReadByUID(ctx context.Context, user identity.Requester, uid string) error
	AuthorizeCreate(ctx context.Context, user identity.Requester) error
	AuthorizeUpdateByUID(ctx context.Context, user identity.Requester, uid string) error
	AuthorizeDeleteByUID(ctx context.Context, user identity.Requester, uid string) error
	SetDefaultPermissions(ctx context.Context, user identity.Requester, route *legacy_storage.ManagedRoute) error
	DeleteAllPermissions(ctx context.Context, orgID int64, route *legacy_storage.ManagedRoute) error
	Access(ctx context.Context, user identity.Requester, routes ...*legacy_storage.ManagedRoute) (map[string]models.RoutePermissionSet, error)
}

type Service struct {
	configStore                         alertmanagerConfigStore
	provenanceStore                     routeProvenanceStore
	xact                                transactionManager
	log                                 log.Logger
	settings                            setting.UnifiedAlertingSettings
	provenanceStatusTransitionValidator validation.ProvenanceStatusTransitionValidator
	FeatureToggles                      featuremgmt.FeatureToggles
	tracer                              tracing.Tracer
	routeAccess                         routeAccessControl
}

func (nps *Service) AccessControlMetadata(ctx context.Context, user identity.Requester, routes ...*legacy_storage.ManagedRoute) (map[string]models.RoutePermissionSet, error) {
	permissions, err := nps.routeAccess.Access(ctx, user, routes...)
	if err != nil {
		return nil, err
	}
	for _, m := range routes {
		if m.Origin == models.ResourceOriginGrafana {
			continue
		}
		perms := permissions[m.GetUID()]
		perms.Set(models.RoutePermissionAdmin, false)
		perms.Set(models.RoutePermissionWrite, false)
		perms.Set(models.RoutePermissionDelete, false)
		permissions[m.GetUID()] = perms
	}
	return permissions, nil
}

func NewService(
	am alertmanagerConfigStore,
	prov routeProvenanceStore,
	xact transactionManager,
	settings setting.UnifiedAlertingSettings,
	features featuremgmt.FeatureToggles,
	log log.Logger,
	validator validation.ProvenanceStatusTransitionValidator,
	tracer tracing.Tracer,
	routeAccess routeAccessControl,
) *Service {
	return &Service{
		configStore:                         am,
		provenanceStore:                     prov,
		xact:                                xact,
		log:                                 log,
		settings:                            settings,
		FeatureToggles:                      features,
		provenanceStatusTransitionValidator: validator,
		tracer:                              tracer,
		routeAccess:                         routeAccess,
	}
}

// GetManagedRoute returns a managed route by name, along with its ManagerProperties.
func (nps *Service) GetManagedRoute(ctx context.Context, orgID int64, name string, user identity.Requester) (legacy_storage.ManagedRoute, utils.ManagerProperties, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.get", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("query_name", name),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()

	if err := nps.routeAccess.AuthorizeReadByUID(ctx, user, name); err != nil {
		return legacy_storage.ManagedRoute{}, utils.ManagerProperties{}, err
	}
	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return legacy_storage.ManagedRoute{}, utils.ManagerProperties{}, err
	}

	route := rev.GetManagedRoute(name)
	if route == nil {
		// Check if this is referring to the imported config.
		if nps.includeImported() {
			route = nps.getImportedRoute(ctx, span, rev)
		}
		if route == nil {
			return legacy_storage.ManagedRoute{}, utils.ManagerProperties{}, models.ErrRouteNotFound.Errorf("route %q not found", name)
		}
	}

	span.AddEvent("Loaded route", trace.WithAttributes(
		attribute.String("concurrency_token", rev.ConcurrencyToken),
	))

	// Imported routes derive their provenance from the external config (ProvenanceConvertedPrometheus).
	// They are not stored in the provenance store, so we must not overwrite with a store lookup
	// which would return ProvenanceNone and cause a discrepancy with the list view.
	if route.Origin == models.ResourceOriginImported {
		return *route, models.ProvenanceToManagerProperties(models.ProvenanceConvertedPrometheus), nil
	}
	provenance, err := nps.provenanceStore.GetProvenance(ctx, route, orgID)
	if err != nil {
		return legacy_storage.ManagedRoute{}, utils.ManagerProperties{}, err
	}
	route.Provenance = provenance
	managerProps, err := nps.provenanceStore.GetManagerProperties(ctx, route, orgID)
	if err != nil {
		return legacy_storage.ManagedRoute{}, utils.ManagerProperties{}, err
	}

	return *route, managerProps, nil
}

// GetManagedRoutes returns all managed routes for the org along with their ManagerProperties,
// keyed by resource UID.
func (nps *Service) GetManagedRoutes(ctx context.Context, orgID int64, user identity.Requester) (legacy_storage.ManagedRoutes, map[string]utils.ManagerProperties, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.getMany", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()

	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, nil, err
	}

	provenances, err := nps.provenanceStore.GetProvenances(ctx, orgID, (&legacy_storage.ManagedRoute{}).ResourceType())
	if err != nil {
		return nil, nil, err
	}
	managerProps, err := nps.provenanceStore.GetAllManagerProperties(ctx, orgID, (&legacy_storage.ManagedRoute{}).ResourceType())
	if err != nil {
		return nil, nil, err
	}

	managedRoutes := rev.GetManagedRoutes()
	for _, mr := range managedRoutes {
		provenance, ok := provenances[mr.ResourceID()]
		if !ok {
			provenance = models.ProvenanceNone
		}
		mr.Provenance = provenance
	}

	if nps.includeImported() {
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
				managerProps[importedRoute.ResourceID()] = models.ProvenanceToManagerProperties(models.ProvenanceConvertedPrometheus)
			}
		}
	}

	span.AddEvent("Loaded routes", trace.WithAttributes(
		attribute.String("concurrency_token", rev.ConcurrencyToken),
		attribute.Int("count", len(managedRoutes)),
	))

	managedRoutes, err = nps.routeAccess.FilterRead(ctx, user, managedRoutes...)
	if err != nil {
		return nil, nil, err
	}

	managedRoutes.Sort()
	return managedRoutes, managerProps, nil
}

func (nps *Service) UpdateManagedRoute(ctx context.Context, orgID int64, name string, subtree v1.Route, manager utils.ManagerProperties, version string, user identity.Requester) (*legacy_storage.ManagedRoute, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.update", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("route_name", name),
		attribute.String("route_version", version),
		attribute.Bool("include_imported", nps.includeImported()),
	))

	if err := nps.routeAccess.AuthorizeUpdateByUID(ctx, user, name); err != nil {
		return nil, err
	}

	err := subtree.Validate()
	if err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	// When a rich manager is provided, the effective provenance is derived from it so the
	// validation, persisted provenance column and returned object all agree.
	p := models.ManagerPropertiesToProvenance(manager)

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
	if err := nps.provenanceStatusTransitionValidator(ctx, storedProvenance, p); err != nil {
		return nil, err
	}

	storedManager, err := nps.provenanceStore.GetManagerProperties(ctx, existing, orgID)
	if err != nil {
		return nil, err
	}
	if !validation.CanUpdateManagerInRuleGroup(storedManager, manager) {
		return nil, errManagerMismatch.Build(errutil.TemplateData{
			Public: map[string]any{
				"ProvidedProvenance": manager.Kind,
				"StoredProvenance":   storedManager.Kind,
				"Operation":          "update",
			},
		})
	}

	updated, err := revision.UpdateNamedRoute(name, subtree)
	if err != nil {
		return nil, err
	}
	updated.Provenance = p

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetManagerProperties(ctx, updated, orgID, manager)
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

func (nps *Service) DeleteManagedRoute(ctx context.Context, orgID int64, name string, manager utils.ManagerProperties, version string, user identity.Requester) error {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.delete", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("route_name", name),
		attribute.String("route_version", version),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()

	if err := nps.routeAccess.AuthorizeDeleteByUID(ctx, user, name); err != nil {
		return err
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

	p := models.ManagerPropertiesToProvenance(manager)
	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, existing, orgID)
	if err != nil {
		return err
	}
	if err := nps.provenanceStatusTransitionValidator(ctx, storedProvenance, p); err != nil {
		return err
	}

	storedManager, err := nps.provenanceStore.GetManagerProperties(ctx, existing, orgID)
	if err != nil {
		return err
	}
	if !validation.CanUpdateManagerInRuleGroup(storedManager, manager) {
		return errManagerMismatch.Build(errutil.TemplateData{
			Public: map[string]any{
				"ProvidedProvenance": manager.Kind,
				"StoredProvenance":   storedManager.Kind,
				"Operation":          "delete",
			},
		})
	}

	action := "Deleted"
	if models.IsDefaultRoutingTreeName(name) {
		defaultCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
		if err != nil {
			return fmt.Errorf("failed to parse default alertmanager config: %w", err)
		}

		_, err = revision.ResetUserDefinedRoute(v1.ToModel(defaultCfg))
		if err != nil {
			return err
		}
		action = "Reset"
	} else {
		revision.DeleteManagedRoute(name)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		if !models.IsDefaultRoutingTreeName(name) { // do not delete permissions on reset of default route
			if err := nps.routeAccess.DeleteAllPermissions(ctx, orgID, existing); err != nil {
				return err
			}
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

func (nps *Service) CreateManagedRoute(ctx context.Context, orgID int64, name string, subtree v1.Route, manager utils.ManagerProperties, user identity.Requester) (*legacy_storage.ManagedRoute, error) {
	ctx, span := nps.tracer.Start(ctx, "alerting.routes.create", trace.WithAttributes(
		attribute.Int64("query_org_id", orgID),
		attribute.String("route_name", name),
		attribute.Bool("include_imported", nps.includeImported()),
	))
	defer span.End()

	if err := nps.routeAccess.AuthorizeCreate(ctx, user); err != nil {
		return nil, err
	}

	// When a rich manager is provided, the effective provenance is derived from it so the
	// validation, persisted provenance column and returned object all agree.
	p := models.ManagerPropertiesToProvenance(manager)
	if err := nps.provenanceStatusTransitionValidator(ctx, models.ProvenanceNone, p); err != nil {
		return nil, err
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

	created.Provenance = p
	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		if err := nps.routeAccess.SetDefaultPermissions(ctx, user, created); err != nil {
			return err
		}
		return nps.provenanceStore.SetManagerProperties(ctx, created, orgID, manager)
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
	return rev.ReceiverUseByName()
}

func (nps *Service) ReceiverNameUsedByRoutes(_ context.Context, rev *legacy_storage.ConfigRevision, name string) bool {
	return rev.ReceiverNameUsedByRoutes(name)
}

func (nps *Service) RenameReceiverInRoutes(_ context.Context, rev *legacy_storage.ConfigRevision, oldName, newName string) map[*v1.Route]int {
	return rev.RenameReceiverInRoutes(oldName, newName)
}

func (nps *Service) RenameTimeIntervalInRoutes(_ context.Context, rev *legacy_storage.ConfigRevision, oldName string, newName string) map[*v1.Route]int {
	return rev.RenameTimeIntervalInRoutes(oldName, newName)
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

func (nps *Service) includeImported() bool {
	if nps.FeatureToggles == nil {
		return false
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	return nps.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI)
}
