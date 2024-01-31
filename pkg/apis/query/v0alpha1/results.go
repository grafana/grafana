package v0alpha1

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

// Wraps backend.QueryDataResponse, however it includes TypeMeta and implements runtime.Object
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataResponse struct {
	metav1.TypeMeta `json:",inline"`

	// Backend wrapper (external dependency)
	backend.QueryDataResponse
}

// Expose backend DataResponse in OpenAPI (yes this still requires some serious love!)
func (r QueryDataResponse) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			},
			VendorExtensible: spec.VendorExtensible{
				Extensions: map[string]interface{}{
					"x-kubernetes-preserve-unknown-fields": true,
				},
			},
		},
	}
}

// MarshalJSON writes the results as json
func (r QueryDataResponse) MarshalJSON() ([]byte, error) {
	return r.QueryDataResponse.MarshalJSON()
}

// UnmarshalJSON will read JSON into a QueryDataResponse
func (r *QueryDataResponse) UnmarshalJSON(b []byte) error {
	return r.QueryDataResponse.UnmarshalJSON(b)
}

func (r *QueryDataResponse) DeepCopy() *QueryDataResponse {
	if r == nil {
		return nil
	}

	// /!\ The most dumb approach, but OK for now...
	// likely best to move DeepCopy into SDK
	out := &QueryDataResponse{}
	body, _ := json.Marshal(r.QueryDataResponse)
	_ = json.Unmarshal(body, &out.QueryDataResponse)
	return out
}

func (r *QueryDataResponse) DeepCopyInto(out *QueryDataResponse) {
	clone := r.DeepCopy()
	*out = *clone
}
