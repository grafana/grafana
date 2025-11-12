package conversion

import (
	"context"

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

	out.Spec.Object = in.Spec.Object

	out.Status = dashv1.DashboardStatus{
		Conversion: &dashv1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv0.VERSION),
		},
	}

	ctx, _, err := prepareV0ConversionContext(in)
	if err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = ptr.To(err.Error())
		return schemaversion.NewMigrationError(err.Error(), schemaversion.GetSchemaVersion(in.Spec.Object), schemaversion.LATEST_VERSION, "Convert_V0_to_V1")
	}

	if err := migrateV0Dashboard(ctx, out.Spec.Object, schemaversion.LATEST_VERSION); err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = ptr.To(err.Error())
		return schemaversion.NewMigrationError(err.Error(), schemaversion.GetSchemaVersion(in.Spec.Object), schemaversion.LATEST_VERSION, "Convert_V0_to_V1")
	}

	return nil
}
