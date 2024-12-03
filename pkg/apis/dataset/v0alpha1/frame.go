package v0alpha1

import (
	"encoding/json"

	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Wrapper for an SDK DataFrame object
type DataFrame struct {
	Frame *data.Frame
}

// Hand constructed OpenAPI spec 😬
func (u DataFrame) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
				Description:          "This schema is currently a placeholder while we define a better OpenAPI spec for DataFrame",
			},
			VendorExtensible: spec.VendorExtensible{
				Extensions: map[string]interface{}{
					"x-kubernetes-preserve-unknown-fields": true,
				},
			},
		},
	}
}

// MarshalJSON ensures that the unstructured object produces proper
// JSON when passed to Go's standard JSON library.
func (d *DataFrame) MarshalJSON() ([]byte, error) {
	return data.FrameToJSON(d.Frame, data.IncludeAll)
}

// UnmarshalJSON ensures that the unstructured object properly decodes
// JSON when passed to Go's standard JSON library.
func (d *DataFrame) UnmarshalJSON(b []byte) error {
	d.Frame = new(data.Frame)
	err := d.Frame.UnmarshalJSON(b)
	if err != nil {
		// HACK Alert!!!
		// Kubectl seems to reverse the order of schema+data
		// This should really really be fixed in:
		// https://github.com/grafana/grafana-plugin-sdk-go/blob/v0.260.1/data/frame_json.go#L277
		type swapper struct {
			Schema json.RawMessage `json:"schema,omitempty"`
			Data   json.RawMessage `json:"data,omitempty"`
		}
		tmp := &swapper{}
		_ = json.Unmarshal(b, tmp)
		b, _ = json.Marshal(tmp) // swap order
		err = d.Frame.UnmarshalJSON(b)
	}
	return err
}

func (d *DataFrame) DeepCopy() *DataFrame {
	if d == nil {
		return nil
	}
	out := new(DataFrame)

	buff, _ := data.FrameToJSON(d.Frame, data.IncludeAll)
	_ = json.Unmarshal(buff, out.Frame)
	return out
}

func (d *DataFrame) DeepCopyInto(out *DataFrame) {
	clone := d.DeepCopy()
	*out = *clone
}
