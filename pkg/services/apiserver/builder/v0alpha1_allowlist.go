package builder

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
)

var v0alpha1ResourcesAllowed = map[string]sets.Set[string]{
	"dashboard.grafana.app": sets.New("dashboards", "dashboards/dto", "search"),
	// nil allows all resources in the group
	"playlist.grafana.app":               nil,
	"iam.grafana.app":                    nil,
	"banner.grafana.app":                 nil,
	"advisor.grafana.app":                nil,
	"notifications.alerting.grafana.app": nil,
	"investigations.grafana.app":         nil,
	"provisioning.grafana.app":           nil,
	// ... add to this list as needed to enable v0alpha1 resources
}

func allowRegisteringResource(gv schema.GroupVersion, resourceName string) bool {
	if gv.Version != "v0alpha1" {
		return true
	}

	allowedResources, ok := v0alpha1ResourcesAllowed[gv.Group]
	if !ok {
		return false
	}

	// if nil, allow all resources
	if allowedResources == nil {
		return true
	}

	return allowedResources.Has(resourceName)
}
