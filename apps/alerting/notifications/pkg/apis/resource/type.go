package resource

import (
	"maps"

	sdkResource "github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/common"

	receiverv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/receiver/v0alpha1"
	routingtreev0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/routingtree/v0alpha1"
	templategroupv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/templategroup/v0alpha1"
	timeintervalv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/timeinterval/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/receiver"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/templategroup"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/timeinterval"
)

var GroupVersion = schema.GroupVersion{Group: "notifications.alerting.grafana.app", Version: "v0alpha1"}

func GetOpenAPIDefinitions(c common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	tmpl := templategroup.GetOpenAPIDefinitions(c)
	tin := timeinterval.GetOpenAPIDefinitions(c)
	recv := receiver.GetOpenAPIDefinitions(c)
	rest := routingtree.GetOpenAPIDefinitions(c)
	result := make(map[string]common.OpenAPIDefinition, len(tmpl)+len(tin)+len(recv)+len(rest))
	maps.Copy(result, tmpl)
	maps.Copy(result, tin)
	maps.Copy(result, recv)
	maps.Copy(result, rest)
	return result
}

func GetKinds() map[schema.GroupVersion][]sdkResource.Kind {
	result := map[schema.GroupVersion][]sdkResource.Kind{
		GroupVersion: {
			receiverv0alpha1.Kind(),
			routingtreev0alpha1.Kind(),
			templategroupv0alpha1.Kind(),
			timeintervalv0alpha1.Kind(),
		},
	}
	return result
}
