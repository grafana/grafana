package apis

import (
	sdkResource "github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

func GetKinds() map[schema.GroupVersion][]sdkResource.Kind {
	result := map[schema.GroupVersion][]sdkResource.Kind{
		v0alpha1.GroupVersion: {
			v0alpha1.AlertRuleKind(),
			v0alpha1.RecordingRuleKind(),
		},
	}
	return result
}
