package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V1beta1_to_V2(in *dashv1.Dashboard, out *dashv2.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	intermediate := &dashv2beta1.Dashboard{}
	if err := Convert_V1_to_V2beta1(in, intermediate, scope, dsIndexProvider, leIndexProvider); err != nil {
		return err
	}
	if err := Convert_V2beta1_to_V2(intermediate, out, scope); err != nil {
		return err
	}
	setDefaultGridLayoutPreference(out)
	return nil
}

// setDefaultGridLayoutPreference pins the classic grid as the default layout for new containers.
// Dashboards migrated from the old (pre-v2) schema predate the auto grid default, so without this
// preference new rows/tabs would switch to auto grid. The frontend v1-to-v2 conversion sets the
// same preference; both conversions must produce identical output.
func setDefaultGridLayoutPreference(out *dashv2.Dashboard) {
	out.Spec.Preferences = &dashv2.DashboardPreferences{
		Layout: &dashv2.DashboardAutoGridLayoutKindOrGridLayoutKind{
			GridLayoutKind: dashv2.NewDashboardGridLayoutKind(),
		},
	}
}
