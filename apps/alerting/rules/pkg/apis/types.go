package apis

import (
	sdkResource "github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

func GetKinds() map[schema.GroupVersion][]sdkResource.Kind {
	result := map[schema.GroupVersion][]sdkResource.Kind{
		v0alpha1.GroupVersion: {
			v0alpha1.AlertRuleKind(),
			v0alpha1.RecordingRuleKind(),
			v0alpha1.RuleSequenceKind(),
			v0alpha1.ConfigKind(),
		},
		v1beta1.GroupVersion: {
			v1beta1.AlertRuleKind(),
			v1beta1.RecordingRuleKind(),
			v1beta1.RuleSequenceKind(),
		},
	}
	return result
}
