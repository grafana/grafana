package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
)

func (in *Dashboard) MutateInternalID() error {
	if id, ok := in.Spec.Object["id"].(float64); ok {
		delete(in.Spec.Object, "id")
		if id != 0 {
			meta, err := utils.MetaAccessor(in)
			if err != nil {
				return err
			}
			meta.SetDeprecatedInternalID(int64(id)) // nolint:staticcheck
		}
	}
	return nil
}

func (in *Dashboard) WithAccessInfoForDTO(access dashboard.DashboardAccess) runtime.Object {
	return &DashboardWithAccessInfo{
		Dashboard: *in,
		Access: DashboardAccess{
			Slug:      access.Slug,
			Url:       access.Url,
			CanSave:   access.CanSave,
			CanEdit:   access.CanEdit,
			CanStar:   access.CanSave,
			CanAdmin:  access.CanAdmin,
			CanDelete: access.CanDelete,
			AnnotationsPermissions: &AnnotationPermission{
				Dashboard:    AnnotationActions(access.AnnotationsPermissions.Dashboard),
				Organization: AnnotationActions(access.AnnotationsPermissions.Organization),
			},
		},
	}
}
