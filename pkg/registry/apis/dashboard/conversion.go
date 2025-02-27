package dashboard

import (
	"github.com/grafana/grafana/pkg/apis/dashboard"
	"k8s.io/apimachinery/pkg/runtime"
)

func ToInternalDashboard(scheme *runtime.Scheme, obj runtime.Object) (*dashboard.Dashboard, error) {
	dash := &dashboard.Dashboard{}
	if err := scheme.Convert(obj, dash, nil); err != nil {
		return nil, err
	}
	return dash, nil
}

func FromInternalDashboard(scheme *runtime.Scheme, dash *dashboard.Dashboard, obj runtime.Object) error {
	return scheme.Convert(dash, obj, nil)
}
