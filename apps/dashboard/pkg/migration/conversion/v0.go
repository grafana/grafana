package conversion

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/utils/ptr"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func Convert_V0_to_V1(in *dashv0.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = dashv1.DashboardStatus{
		Conversion: &dashv1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv0.VERSION),
		},
	}

	// Hack, generate "request" context with namespace info injected,
	// that migrate.Migrate will use
	ctx := request.WithNamespace(context.Background(), in.GetNamespace())
	nsInfo, err := types.ParseNamespace(in.GetNamespace())
	if err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = ptr.To(err.Error())
		return nil
	}

	ctx, _ = identity.WithServiceIdentity(ctx, nsInfo.OrgID)

	if err := migration.Migrate(ctx, out.Spec.Object, schemaversion.LATEST_VERSION); err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = ptr.To(err.Error())
		return nil
	}

	return nil
}

func Convert_V0_to_V2alpha1(in *dashv0.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO (@radiohead): implement V0 to V2 conversion
	// This is the bare minimum conversion that is needed to make the dashboard servable.

	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// We need to make sure the layout is set to some value, otherwise the JSON marshaling will fail.
	out.Spec.Layout = dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: dashv2alpha1.DashboardGridLayoutSpec{},
		},
	}

	out.Status = dashv2alpha1.DashboardStatus{
		Conversion: &dashv2alpha1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv0.VERSION),
			Failed:        true,
			Error:         ptr.To("backend conversion not yet implemented"),
		},
	}

	return nil
}

func Convert_V0_to_V2beta1(in *dashv0.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V0 to v2beta1 conversion

	out.Status = dashv2beta1.DashboardStatus{
		Conversion: &dashv2beta1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv0.VERSION),
			Failed:        true,
			Error:         ptr.To("backend conversion not yet implemented"),
		},
	}

	return nil
}
