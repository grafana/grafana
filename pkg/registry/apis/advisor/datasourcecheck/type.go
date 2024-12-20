package datasourcecheck

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	model "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
)

var ResourceInfo = model.DatasourceCheckResourceInfo

func AddKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(ResourceInfo.GroupVersion(),
		&model.DatasourceCheck{},
		&model.DatasourceCheckList{},
	)
	metav1.AddToGroupVersion(scheme, ResourceInfo.GroupVersion())
	return nil
}
