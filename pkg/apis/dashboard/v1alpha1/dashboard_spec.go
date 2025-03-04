package v1alpha1

import common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"

// +k8s:openapi-gen=true
type DashboardSpec struct {
	Title               string `json:"title"`
	common.Unstructured `json:",inline"`
}

// NewDashboardSpec creates a new Spec object.
func NewDashboardSpec() *DashboardSpec {
	return &DashboardSpec{}
}
