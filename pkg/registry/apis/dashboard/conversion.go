package dashboard

import (
	"github.com/grafana/grafana/pkg/apis/dashboard"
	"k8s.io/apimachinery/pkg/runtime"
)

func ToInternalDashboard(scheme *runtime.Scheme, obj runtime.Object) (*dashboard.Dashboard, error) {
	dashboard := &dashboard.Dashboard{}
	if err := scheme.Convert(obj, dashboard, nil); err != nil {
		return nil, err
	}
	return dashboard, nil
}
