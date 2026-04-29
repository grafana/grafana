package iam

import (
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

type wrapperObserver struct{}

// NewWrapperObserver records storewrapper timings in the IAM resource handler latency histogram.
func NewWrapperObserver() storewrapper.Observer {
	return wrapperObserver{}
}

func (wrapperObserver) Observe(layer, op string, resource schema.GroupResource, dur time.Duration, status string) {
	ResourceHandlerDurationHistogram.WithLabelValues(layer, op, resource.Group+"/"+resource.Resource, status).Observe(dur.Seconds())
}
