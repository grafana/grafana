package apiserver

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/kindsys"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// This offers a transition path where we write to SQL first, then into our k8s storage
type DualWriter struct {
	dashboardStore database.DashboardSQLStore
}

func (d *DualWriter) create(kind kindsys.Core, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	if kind.MachineName() == "Dashboards" {
		fmt.Printf("TODO, create dashboard in SQL storage (may be an update!): %s\b", obj.GetName())

		// if provisioning == nil {
		// 	return s.DashboardSQLStore.SaveDashboard(ctx, cmd)
		// }
		// return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
	}
	return obj, nil
}

func (d *DualWriter) update(kind kindsys.Core, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	if kind.MachineName() == "Dashboards" {
		fmt.Printf("TODO, update dashboard in SQL storage (may be an update!): %s\b", obj.GetName())

		// if provisioning == nil {
		// 	return s.DashboardSQLStore.SaveDashboard(ctx, cmd)
		// }
		// return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
	}
	return obj, nil
}

func (d *DualWriter) delete(kind kindsys.Core, grn string) error {
	if kind.MachineName() == "Dashboards" {
		fmt.Printf("TODO, delete dashboard in SQL storage (may be an update!): %s\b", grn)

		// if provisioning == nil {
		// 	return s.DashboardSQLStore.SaveDashboard(ctx, cmd)
		// }
		// return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
	}
	return nil
}
