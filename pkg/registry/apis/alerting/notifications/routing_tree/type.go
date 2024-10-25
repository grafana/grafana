package routing_tree

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	model "github.com/grafana/grafana/apps/alerting/notifications/apis/resource/routingtree/v0alpha1"
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
