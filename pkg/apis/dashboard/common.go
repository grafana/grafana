package dashboard

import (
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type DashboardCommon interface {
	MutateInternalID() error
	WithAccessInfoForDTO(access DashboardAccess) runtime.Object
}

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

func (in *Dashboard) WithAccessInfoForDTO(access DashboardAccess) runtime.Object {
	return &DashboardWithAccessInfo{
		Dashboard: *in,
		Access:    access,
	}
}
