package apis

import (
	sdkResource "github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
)

func GetKinds() map[schema.GroupVersion][]sdkResource.Kind {
	return map[schema.GroupVersion][]sdkResource.Kind{
		v0alpha1.GroupVersion: {
			v0alpha1.PrometheusRuleFileKind(),
		},
	}
}
