package conversion

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/utils/ptr"

	"github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// prepareV0ConversionContext sets up the context with namespace and service identity
// for v0 dashboard conversions. This context is needed to retrieve datasources for migrating
// old dashboard schemas (these migrations used to be run in the frontend).
// A background service identity is used because the user who is reading the specific dashboard
// may not have access to all the datasources in the dashboard, but the migration still needs to take place
// in order to be able to convert between k8s versions (so that we have a guaranteed structure to convert between).
func prepareV0ConversionContext(in *dashv0.Dashboard) (context.Context, *types.NamespaceInfo, error) {
	ctx := request.WithNamespace(context.Background(), in.GetNamespace())
	nsInfo, err := types.ParseNamespace(in.GetNamespace())
	if err != nil {
		return nil, nil, err
	}

	ctx, _ = identity.WithServiceIdentity(ctx, nsInfo.OrgID)
	return ctx, &nsInfo, nil
}

// migrateV0Dashboard migrates a v0 dashboard object to the target schema version.
// This is used to ensure the dashboard structure is consistent before converting between k8s API versions.
func migrateV0Dashboard(ctx context.Context, dashboardObject map[string]interface{}, targetVersion int) error {
	if ctx == nil {
		return schemaversion.NewMigrationError("context is nil", schemaversion.GetSchemaVersion(dashboardObject), targetVersion, "migrateV0Dashboard")
	}
	return migration.Migrate(ctx, dashboardObject, targetVersion)
}

// ConvertDashboard_V0_to_V1beta1 converts a v0alpha1 dashboard to v1beta1 format.
// This is an atomic single-step conversion that:
// 1. Migrates the dashboard to the latest schema version
// 2. Transforms the migrated dashboard to v1beta1 format
//
// the scope passed into this function is used in k8s apimachinery for migrations, but we also need the context
// to have what grafana expects in the request context, so that we can retrieve datasources for migrating
// some of the old dashboard schemas (these migrations used to be run in the frontend)
//
// a background service identity is used here because the user who is reading the specific dashboard
// may not have access to all the datasources in the dashboard, but the migration still needs to take place
// in order to be able to convert between k8s versions (so that we have a guaranteed structure to convert between)
func ConvertDashboard_V0_to_V1beta1(in *dashv0.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv1.APIVERSION
	out.Kind = in.Kind

	out.Spec.Object = in.Spec.Object

	out.Status = dashv1.DashboardStatus{
		Conversion: &dashv1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv0.VERSION),
		},
	}

	ctx := context.Background()
	if scope != nil && scope.Meta() != nil && scope.Meta().Context != nil {
		if scopeCtx, ok := scope.Meta().Context.(context.Context); ok {
			ctx = scopeCtx
		}
	}

	ctxWithNamespace, _, err := prepareV0ConversionContext(in)
	if err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = ptr.To(err.Error())
		return schemaversion.NewMigrationError(err.Error(), schemaversion.GetSchemaVersion(in.Spec.Object), schemaversion.LATEST_VERSION, "Convert_V0_to_V1")
	}

	// merge contexts to have namespace and spans
	if ctxWithNamespace != nil {
		if ns := request.NamespaceValue(ctxWithNamespace); ns != "" {
			ctx = request.WithNamespace(ctx, ns)
		}
	}

	sourceSchemaVersion := schemaversion.GetSchemaVersion(in.Spec.Object)
	ctx, span := TracingStart(ctx, "dashboard.conversion.v0alpha1_to_v1beta1",
		attribute.String("dashboard.uid", in.Name),
		attribute.String("dashboard.namespace", in.Namespace),
		attribute.String("source.version", dashv0.APIVERSION),
		attribute.String("target.version", dashv1.APIVERSION),
		attribute.Int("source.schema_version", sourceSchemaVersion),
	)
	defer span.End()

	if err := migrateV0Dashboard(ctx, out.Spec.Object, schemaversion.LATEST_VERSION); err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = ptr.To(err.Error())
		return schemaversion.NewMigrationError(err.Error(), schemaversion.GetSchemaVersion(in.Spec.Object), schemaversion.LATEST_VERSION, "Convert_V0_to_V1")
	}

	span.SetAttributes(attribute.Int("target.schema_version", schemaversion.LATEST_VERSION))

	// Normalize template variable datasources from string to object format
	// This handles legacy dashboards where query variables have datasource: "$datasource" (string)
	// instead of datasource: { uid: "$datasource" } (object)
	// our migration pipeline in v36 doesn't address because this was not addressed historically
	// in DashboardMigrator - see public/app/features/dashboard/state/DashboardMigrator.ts#L607
	// Which means that we have schemaVersion: 42 dashboards where datasource variable references are still strings
	normalizeTemplateVariableDatasources(out.Spec.Object)

	// Normalize panel and target datasources from string to object format
	// This handles legacy dashboards where panels/targets have datasource: "$datasource" (string)
	// instead of datasource: { uid: "$datasource" } (object)
	normalizePanelDatasources(out.Spec.Object)

	return nil
}

// normalizeTemplateVariableDatasources converts template variable string datasources to object format.
// Legacy dashboards may have query variables with datasource: "$datasource" (string).
// This normalizes them to datasource: { uid: "$datasource" } for consistent V1→V2 conversion.
func normalizeTemplateVariableDatasources(dashboard map[string]interface{}) {
	templating, ok := dashboard["templating"].(map[string]interface{})
	if !ok {
		return
	}

	list, ok := templating["list"].([]interface{})
	if !ok {
		return
	}

	for _, variable := range list {
		varMap, ok := variable.(map[string]interface{})
		if !ok {
			continue
		}

		varType, _ := varMap["type"].(string)
		if varType != "query" {
			continue
		}

		ds := varMap["datasource"]
		if dsStr, ok := ds.(string); ok && isTemplateVariableRef(dsStr) {
			// Convert string template variable reference to object format
			varMap["datasource"] = map[string]interface{}{
				"uid": dsStr,
			}
		}
	}
}

// isTemplateVariableRef checks if a string is a Grafana template variable reference.
// Template variables can be in the form: $varname or ${varname}
func isTemplateVariableRef(s string) bool {
	if s == "" {
		return false
	}
	return strings.HasPrefix(s, "$") || strings.HasPrefix(s, "${")
}

// normalizePanelDatasources converts panel and target string datasources to object format.
// Legacy dashboards may have panels/targets with datasource: "$datasource" (string).
// This normalizes them to datasource: { uid: "$datasource" } for consistent V1→V2 conversion.
func normalizePanelDatasources(dashboard map[string]interface{}) {
	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return
	}

	normalizePanelsDatasources(panels)
}

// normalizePanelsDatasources normalizes datasources in a list of panels (including nested row panels)
func normalizePanelsDatasources(panels []interface{}) {
	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Handle row panels with nested panels
		if panelType, _ := panelMap["type"].(string); panelType == "row" {
			if nestedPanels, ok := panelMap["panels"].([]interface{}); ok {
				normalizePanelsDatasources(nestedPanels)
			}
		}

		// Normalize panel-level datasource
		if ds := panelMap["datasource"]; ds != nil {
			if dsStr, ok := ds.(string); ok && isTemplateVariableRef(dsStr) {
				panelMap["datasource"] = map[string]interface{}{
					"uid": dsStr,
				}
			}
		}

		// Normalize target-level datasources
		targets, ok := panelMap["targets"].([]interface{})
		if !ok {
			continue
		}

		for _, target := range targets {
			targetMap, ok := target.(map[string]interface{})
			if !ok {
				continue
			}

			if ds := targetMap["datasource"]; ds != nil {
				if dsStr, ok := ds.(string); ok && isTemplateVariableRef(dsStr) {
					targetMap["datasource"] = map[string]interface{}{
						"uid": dsStr,
					}
				}
			}
		}
	}
}
