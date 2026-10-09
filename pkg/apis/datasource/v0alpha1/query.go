package v0alpha1

import (
	"net/http"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
)

// Generic query request with shared time across all values
// Copied from: https://github.com/grafana/grafana/blob/main/pkg/api/dtos/models.go#L62
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataRequest struct {
	metav1.TypeMeta `json:",inline"`

	// The time range used when not included on each query
	data.QueryDataRequest `json:",inline"`
}

func (QueryDataRequest) OpenAPIModelName() string {
	return OpenAPIPrefix + "QueryDataRequest"
}

// Wraps backend.QueryDataResponse, however it includes TypeMeta and implements runtime.Object
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataResponse struct {
	metav1.TypeMeta `json:",inline"`

	// Backend wrapper (external dependency)
	backend.QueryDataResponse `json:",inline"`
}

func (QueryDataResponse) OpenAPIModelName() string {
	return OpenAPIPrefix + "QueryDataResponse"
}

// GetResponseCode return the right status code for the response by checking the responses.
func GetResponseCode(rsp *backend.QueryDataResponse) int {
	if rsp == nil {
		return http.StatusBadRequest // rsp is nil, so we return a 400
	}
	// Responses is a map, so its iteration order is randomized. Walk it in refID order so a
	// given response always reports the same status, and let a plugin error outrank a
	// downstream one -- the precedence ErrorSourceMiddleware already applies, and the safe
	// direction: a genuine plugin failure must not be hidden behind a tenant's bad config.
	refIDs := make([]string, 0, len(rsp.Responses))
	for refID := range rsp.Responses {
		refIDs = append(refIDs, refID)
	}
	slices.Sort(refIDs)

	var (
		downstream     backend.DataResponse
		haveDownstream bool
	)

	for _, refID := range refIDs {
		res := rsp.Responses[refID]
		if res.Error == nil {
			continue
		}

		if res.ErrorSource == backend.ErrorSourceDownstream {
			if !haveDownstream {
				downstream, haveDownstream = res, true
			}
			continue
		}

		// Not explicitly downstream, so treat it as ours -- including an unset error source,
		// where over-reporting a server error beats hiding one.
		if res.Status != 0 {
			return int(res.Status)
		}

		return http.StatusBadRequest // Status is nil but we have an error, so we return a 400
	}

	if haveDownstream {
		// A downstream error is the data source's failure, not this API server's, so it must
		// never surface as a 5xx here. Note that we cannot trust res.Status to say so: the
		// SDK sets ErrorSource and Status independently, and Status falls back to
		// StatusUnknown (500) for any error it cannot classify -- which is most of them, since
		// plugins typically return a plain error. That fallback is applied both by
		// ErrorSourceMiddleware and again during protobuf conversion, so a plugin that leaves
		// Status unset always arrives here as a 500. Honor an explicit downstream 4xx so
		// callers keep the detail; collapse everything else to 400.
		if downstream.Status >= 400 && downstream.Status < 500 {
			return int(downstream.Status)
		}
		return http.StatusBadRequest
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

func (QueryTypeDefinition) OpenAPIModelName() string {
	return OpenAPIPrefix + "QueryTypeDefinition"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinitionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTypeDefinition `json:"items"`
}

func (QueryTypeDefinitionList) OpenAPIModelName() string {
	return OpenAPIPrefix + "QueryTypeDefinitionList"
}
