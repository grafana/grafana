package v0alpha1

import (
	conversion "k8s.io/apimachinery/pkg/conversion"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/apis/dashboard/migration"
)

func Convert_v0alpha1_Dashboard_To_dashboard_Dashboard(in *Dashboard, out *dashboard.Dashboard, s conversion.Scope) error {
	*out = dashboard.Dashboard{
		TypeMeta:   in.TypeMeta,
		ObjectMeta: in.ObjectMeta,
		Spec:       migration.DashboardSpec{},
	}
	return out.Spec.FromUnstructured(in.Spec)
}

func Convert_dashboard_Dashboard_To_v0alpha1_Dashboard(in *dashboard.Dashboard, out *Dashboard, s conversion.Scope) error {
	clone, err := in.Spec.ToUnstructured()
	if err != nil {
		return err
	}
	*out = Dashboard{
		TypeMeta:   in.TypeMeta,
		ObjectMeta: in.ObjectMeta,
		Spec:       clone,
	}
	return nil
}
