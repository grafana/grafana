package v0alpha1

import (
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:openapi-gen=true
type PrometheusSpec = common.Unstructured

// NewDashboardSpec creates a new Spec object.
func NewPrometheusSpec() *PrometheusSpec {
	return &PrometheusSpec{}
}
