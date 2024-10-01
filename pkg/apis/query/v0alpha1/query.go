package v0alpha1

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Generic query request with shared time across all values
// Copied from: https://github.com/grafana/grafana/blob/main/pkg/api/dtos/models.go#L62
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataRequest struct {
	metav1.TypeMeta `json:",inline"`

	// The time range used when not included on each query
	data.QueryDataRequest `json:",inline"`
}

// Wraps backend.QueryDataResponse, however it includes TypeMeta and implements runtime.Object
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataResponse struct {
	metav1.TypeMeta `json:",inline"`

	// Backend wrapper (external dependency)
	backend.QueryDataResponse `json:",inline"`
}

// GetResponseCode return the right status code for the response by checking the responses.
func GetResponseCode(rsp *backend.QueryDataResponse) int {
	if rsp == nil {
		return http.StatusBadRequest
	}
	for _, res := range rsp.Responses {
		if res.Error != nil {
			return http.StatusBadRequest
		}
	}
	return http.StatusOK
}

// Defines a query behavior in a datasource.  This is a similar model to a CRD where the
// payload describes a valid query
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinition struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec data.QueryTypeDefinitionSpec `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinitionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTypeDefinition `json:"items,omitempty"`
}
