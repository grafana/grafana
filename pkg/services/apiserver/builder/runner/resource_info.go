package runner

import (
	"strings"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"k8s.io/apimachinery/pkg/runtime"
)

func KindToResourceInfo(kind resource.Kind) utils.ResourceInfo {
	return utils.NewResourceInfo(
		kind.Group(),
		kind.Version(),
		kind.GroupVersionResource().Resource,
		strings.ToLower(kind.Kind()),
		kind.Kind(),
		func() runtime.Object { return kind.ZeroValue() },
		func() runtime.Object { return kind.ZeroListValue() },
		utils.TableColumns{}, // TODO: this only supports the default columns
	)
}
