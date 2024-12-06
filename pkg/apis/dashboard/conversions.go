package dashboard

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardsvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
)

func LegacyUpdateCommandToUnstructured(cmd dashboardsvc.SaveDashboardCommand) unstructured.Unstructured {
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": cmd.Dashboard,
		},
	}
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}
	obj.SetName(cmd.UID)
	return obj
}
