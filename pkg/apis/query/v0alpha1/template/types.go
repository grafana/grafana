package template

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type QueryTemplate struct {
	// A display name
	Title string `json:"title,omitempty"`

	// Longer description for why it is interesting
	Description string `json:"description,omitempty"`

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

	// Query target
	Properties query.GenericDataQuery `json:"properties"`
}

// TemplateVariable is the definition of a variable that will be interpolated
// in targets.
type TemplateVariable struct {
	// Key is the name of the variable.
	Key string `json:"key"`

	// DefaultValue is the value to be used when there is no selected value
	// during render.
	// +listType=atomic
	DefaultValues []string `json:"defaultValues,omitempty"`

	// ValueListDefinition is the object definition used by the FE
	// to get a list of possible values to select for render.
	ValueListDefinition common.Unstructured `json:"valueListDefinition,omitempty"`
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
	Format VariableFormat `json:"format,omitempty"`
}

// Define how to format values in the template.
// See: https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/#advanced-variable-format-options
// +enum
type VariableFormat string

// Defines values for ItemType.
const (
	// Formats variables with multiple values as a comma-separated string.
	FormatCSV VariableFormat = "csv"

	// Formats variables with multiple values as a comma-separated string.
	FormatJSON VariableFormat = "json"

	// Formats single- and multi-valued variables into a comma-separated string
	FormatDoubleQuote VariableFormat = "doublequote"

	// Formats single- and multi-valued variables into a comma-separated string
	FormatSingleQuote VariableFormat = "singlequote"

	// Formats variables with multiple values into a pipe-separated string.
	FormatPipe VariableFormat = "pipe"

	// Formats variables with multiple values into comma-separated string.
	// This is the default behavior when no format is specified
	FormatRaw VariableFormat = "raw"
)

// Position is where to do replacement in the targets
// during render.
type Position struct {
	// Start is the byte offset within TargetKey's property of the variable.
	// It is the start location for replacements).
	Start int64 `json:"start"` // TODO: byte, rune?

	// End is the byte offset of the end of the variable.
	End int64 `json:"end"`
}
