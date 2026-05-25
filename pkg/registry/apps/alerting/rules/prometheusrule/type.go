package prometheusrule

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var kind = model.PrometheusRuleKind()

var ResourceInfo = utils.NewResourceInfo(kind.Group(), kind.Version(),
	kind.GroupVersionResource().Resource, strings.ToLower(kind.Kind()), kind.Kind(),
	func() runtime.Object { return kind.ZeroValue() },
	func() runtime.Object { return kind.ZeroListValue() },
	utils.TableColumns{},
)

const (
	// DatasourceUIDAnnotationKey is the annotation that selects the Prometheus
	// datasource the rules will query. Optional; defaults to defaultDatasourceUID.
	DatasourceUIDAnnotationKey = "rules.alerting.grafana.app/datasource-uid"

	// SourceLabelKey is added to every alert rule produced from a PrometheusRule
	// resource so reads can partition results back into the originating resource.
	SourceLabelKey = "grafana.com/prometheusrule-source"
)
