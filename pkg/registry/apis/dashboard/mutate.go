package dashboard

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func (b *DashboardsAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()

	// Mutate removes any internal ID set in the spec & adds it as a label
	if op != admission.Create && op != admission.Update {
		return nil
	}
	var internalID int64
	obj := a.GetObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}

	switch v := obj.(type) {
	case *dashboardV0.Dashboard:
		delete(v.Spec.Object, "uid")
		delete(v.Spec.Object, "version")
		if id, ok := v.Spec.Object["id"].(float64); ok {
			delete(v.Spec.Object, "id")
			internalID = int64(id)
		}
	case *dashboardV1.Dashboard:
		delete(v.Spec.Object, "uid")
		delete(v.Spec.Object, "version")
		if id, ok := v.Spec.Object["id"].(float64); ok {
			delete(v.Spec.Object, "id")
			internalID = int64(id)
		}
		// do not error here if the migrations fail
		err = migration.Migrate(v.Spec.Object, schemaversion.LATEST_VERSION)
		if err != nil {
			v.Status.Conversion = &dashboardV1.DashboardConversionStatus{
				Failed: true,
				Error:  err.Error(),
			}
		}
	case *dashboardV2.Dashboard:
		// Noop for V2
	default:
		return fmt.Errorf("mutation error: expected to dashboard, got %T", obj)
	}

	if internalID != 0 {
		meta.SetDeprecatedInternalID(internalID) // nolint:staticcheck
	}

	return nil
}
