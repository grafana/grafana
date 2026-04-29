package iam

import (
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

const (
	permissionLayerStoreWrapper      = "store_wrapper"
	permissionLayerStoreWrapperAuthz = "store_wrapper_authz"
)

type wrapperObserver struct{}

// NewWrapperObserver records storewrapper timings in the IAM permission latency histogram.
func NewWrapperObserver() storewrapper.Observer {
	return wrapperObserver{}
}

func (wrapperObserver) Observe(layer, op string, resource schema.GroupResource, dur time.Duration, status string) {
	promLayer := permissionLayerStoreWrapper
	if layer == storewrapper.LayerAuthz {
		promLayer = permissionLayerStoreWrapperAuthz
	}
	PermissionLatencyHistogram.WithLabelValues(promLayer, op, groupResourceLabel(resource), status).Observe(dur.Seconds())
}

func groupResourceLabel(resource schema.GroupResource) string {
	if resource.Group == "" && resource.Resource == "" {
		return "unknown"
	}
	if resource.Group == "" {
		return resource.Resource
	}
	return resource.Group + "/" + resource.Resource
}
