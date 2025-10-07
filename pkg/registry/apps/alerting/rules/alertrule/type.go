package alertrule

import (
	"strings"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"k8s.io/apimachinery/pkg/runtime"
)

var kind = model.AlertRuleKind()

var ResourceInfo = utils.NewResourceInfo(kind.Group(), kind.Version(),
	kind.GroupVersionResource().Resource, strings.ToLower(kind.Kind()), kind.Kind(),
	func() runtime.Object { return kind.ZeroValue() },
	func() runtime.Object { return kind.ZeroListValue() },
	utils.TableColumns{},
)
