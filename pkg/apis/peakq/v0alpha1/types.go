package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTemplate struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec QueryTemplateSpec `json:"spec,omitempty"`
}

type QueryTemplateSpec struct {
	Title string `json:"title"`

	// The variables that can be used to render
	// +listType=map
	// +listMapKey=key
	Variables []QueryVariable `json:"vars,omitempty"`

	// Output variables
	// +listType=set
	Targets []Target `json:"targets"`
}

type Target struct {
	// DataType is the returned Dataplane type from the query.
	DataType data.FrameType `json:"dataType,omitempty"`

	// DataTypeVersion is the version for the Dataplane type.
	// TODO 2[uint] seems to panic, maybe implement DeepCopy on data.FrameTypeVersion?
	// DataTypeVersion data.FrameTypeVersion `json:"dataTypeVersion,omitempty"`

	Properties common.Unstructured `json:"properties"`
}

// QueryVariable is the definition of a variable that will be interpolated
// in targets.
type QueryVariable struct {
	// Key is the name of the variable.
	Key string `json:"key"`

	// DefaultValue is the value to be used when there is no selected value
	// during render.
	DefaultValue string `json:"defaultValue"`

	// Positions is a list of where to perform the interpolation
	// within targets during render.
	// +listType=atomic
	Positions []Position `json:"positions"`

	// ValueListDefinition is the object definition used by the FE
	// to get a list of possible values to select for render.
	ValueListDefinition common.Unstructured `json:"valueListDefinition"`
}

// Position is where to do replacement in the targets
// during render.
type Position struct {
	// IndexIdx is the index of the target in The QueryTemplateSpec Targets property.
	TargetIdx int `json:"targetIdx"`

	// TargetKey is the location of the property within the the target properties.
	// The format for this is not figured out yet (Maybe JSONPath?).
	TargetKey string `json:"targetKey"`

	// Start is the byte offset within TargetKey's property of the variable.
	// It is the start location for replacements).
	Start int64 `json:"start"` // TODO: byte, rune?

	// End is the byte offset of the end of the variable.
	End int64 `json:"end"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTemplateList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTemplate `json:"items,omitempty"`
}

// Dummy object that represents a real query object
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RenderedQuery struct {
	metav1.TypeMeta `json:",inline"`

	// +listType=atomic
	Targets []Target `json:"targets,omitempty"`
}
