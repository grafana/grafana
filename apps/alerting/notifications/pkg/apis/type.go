package apis

import (
	"maps"

	sdkResource "github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
	receiverv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/receiver/v0alpha1"
	receiverv0alpha2 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/receiver/v0alpha2"
	routingtreev0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/routingtree/v0alpha1"
	templategroupv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/templategroup/v0alpha1"
	timeintervalv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/timeinterval/v0alpha1"
)

func GetOpenAPIDefinitions(c common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	tmpl := templategroupv0alpha1.GetOpenAPIDefinitions(c)
	tin := timeintervalv0alpha1.GetOpenAPIDefinitions(c)
	recv1 := receiverv0alpha1.GetOpenAPIDefinitions(c)
	recv2 := receiverv0alpha2.GetOpenAPIDefinitions(c)
	rest := routingtreev0alpha1.GetOpenAPIDefinitions(c)
	result := make(map[string]common.OpenAPIDefinition, len(tmpl)+len(tin)+len(recv1)+len(rest)+len(recv2))
	maps.Copy(result, tmpl)
	maps.Copy(result, tin)
	maps.Copy(result, recv1)
	maps.Copy(result, recv2)
	maps.Copy(result, rest)
	return result
}

func GetKinds() map[schema.GroupVersion][]sdkResource.Kind {
	result := map[schema.GroupVersion][]sdkResource.Kind{
		v0alpha1.GroupVersion: {
			receiverv0alpha1.Kind(),
			routingtreev0alpha1.Kind(),
			templategroupv0alpha1.Kind(),
			timeintervalv0alpha1.Kind(),
		},
		receiverv0alpha2.GroupVersion: {
			receiverv0alpha2.Kind(),
		},
	}
	return result
}
