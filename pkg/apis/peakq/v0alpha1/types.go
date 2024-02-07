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
	Variables []TemplateVariable `json:"vars,omitempty"`

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

	// Variables that will be replaced in the query
	Variables map[string][]VariableReplacement `json:"variables"`

	// The raw query: TODO, should be query.GenericQuery
	Properties common.Unstructured `json:"properties"`
}

// TemplateVariable is the definition of a variable that will be interpolated
// in targets.
type TemplateVariable struct {
	// Key is the name of the variable.
	Key string `json:"key"`

	// DefaultValue is the value to be used when there is no selected value
	// during render.
	// +listType=atomic
	DefaultValues []string `json:"defaultValue"`

	// ValueListDefinition is the object definition used by the FE
	// to get a list of possible values to select for render.
	ValueListDefinition common.Unstructured `json:"valueListDefinition"`
}

// QueryVariable is the definition of a variable that will be interpolated
// in targets.
type VariableReplacement struct {
	// Path is the location of the property within a target.
	// The format for this is not figured out yet (Maybe JSONPath?).
	// Idea: ["string", int, "string"] where int indicates array offset
	Path string `json:"path"`

	// Positions is a list of where to perform the interpolation
	// within targets during render.
	// The first string is the Idx of the target as a string, since openAPI
	// does not support ints as map keys
	Position *Position `json:"position,omitempty"`

	// How values should be interpolated
	// See: https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/#advanced-variable-format-options
	// NOTE: the format parameter is not yet supported!
	Format string `json:"format,omitempty"`

	// Keep track of the values from previous iterations
	History []ReplacementHistory `json:"history,omitempty"`
}

type ReplacementHistory struct {
	// Who/what made the change
	Source string `json:"source,omitempty"`

	// Value before replacement
	Previous string `json:"previous"`

	// The value(s) that replaced the section
	Replacement []string `json:"replacement"`
}

// Position is where to do replacement in the targets
// during render.
type Position struct {
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
