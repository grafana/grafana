package routingtree

import (
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/routingtree/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var kind = model.Kind()
var GetOpenAPIDefinitions = model.GetOpenAPIDefinitions
var ResourceInfo = utils.NewResourceInfo(kind.Group(), kind.Version(),
	kind.GroupVersionResource().Resource, strings.ToLower(kind.Kind()), kind.Kind(),
	func() runtime.Object { return kind.ZeroValue() },
	func() runtime.Object { return kind.ZeroListValue() },
	utils.TableColumns{},
)

func AddKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(ResourceInfo.GroupVersion(),
		&model.RoutingTree{},
		&model.RoutingTreeList{},
	)
	metav1.AddToGroupVersion(scheme, ResourceInfo.GroupVersion())
	return nil
}
