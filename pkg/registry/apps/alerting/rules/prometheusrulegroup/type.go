package prometheusrulegroup

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var kind = model.PrometheusRuleGroupKind()

var ResourceInfo = utils.NewResourceInfo(kind.Group(), kind.Version(),
	kind.GroupVersionResource().Resource, strings.ToLower(kind.Kind()), kind.Kind(),
	func() runtime.Object { return kind.ZeroValue() },
	func() runtime.Object { return kind.ZeroListValue() },
	utils.TableColumns{},
)

const (
	DatasourceUIDAnnotationKey = "rules.alerting.grafana.app/datasource-uid"
)
