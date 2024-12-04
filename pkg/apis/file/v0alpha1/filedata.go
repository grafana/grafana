package v0alpha1

import (
	"encoding/json"

	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

type FileContents struct {
	Type     string
	Name     string
	Contents string
}

// Wrapper for an SDK DataFrame object
type FileData struct {
	Contents *FileContents
}

// Hand constructed OpenAPI spec 😬
func (d FileData) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
				Description:          "This schema is currently a placeholder while we define a better OpenAPI spec for FileData",
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
func (d *FileData) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.Contents)
}

// UnmarshalJSON ensures that the unstructured object properly decodes
// JSON when passed to Go's standard JSON library.
func (d *FileData) UnmarshalJSON(b []byte) error {
	d.Contents = new(FileContents)
	err := json.Unmarshal(b, d.Contents)
	// if err != nil {
	// 	// HACK Alert!!!
	// 	// Kubectl seems to reverse the order of schema+data
	// 	// This should really really be fixed in:
	// 	// https://github.com/grafana/grafana-plugin-sdk-go/blob/v0.260.1/data/frame_json.go#L277
	// 	type swapper struct {
	// 		Schema json.RawMessage `json:"schema,omitempty"`
	// 		Data   json.RawMessage `json:"data,omitempty"`
	// 	}
	// 	tmp := &swapper{}
	// 	_ = json.Unmarshal(b, tmp)
	// 	b, _ = json.Marshal(tmp) // swap order
	// 	err = d.Frame.UnmarshalJSON(b)
	// }
	return err
}

func (d *FileData) DeepCopy() *FileData {
	if d == nil {
		return nil
	}
	out := new(FileData)

	buff, _ := json.Marshal(d)
	_ = json.Unmarshal(buff, out)
	return out
}

func (d *FileData) DeepCopyInto(out *FileData) {
	clone := d.DeepCopy()
	*out = *clone
}
