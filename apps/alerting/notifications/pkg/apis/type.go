package apis

import (
	sdkResource "github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
)

func GetKinds() map[schema.GroupVersion][]sdkResource.Kind {
	result := map[schema.GroupVersion][]sdkResource.Kind{
		v0alpha1.GroupVersion: {
			v0alpha1.ReceiverKind(),
			v0alpha1.RoutingTreeKind(),
			v0alpha1.TemplateGroupKind(),
			v0alpha1.TimeIntervalKind(),
		},
	}
	return result
}
