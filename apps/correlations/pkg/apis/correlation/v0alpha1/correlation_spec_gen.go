// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CorrelationCorrelationType string

const (
	CorrelationCorrelationTypeQuery    CorrelationCorrelationType = "query"
	CorrelationCorrelationTypeExternal CorrelationCorrelationType = "external"
)

// +k8s:openapi-gen=true
type CorrelationDataSourceRef struct {
	// same as pluginId
	Group string `json:"group"`
	// same as grafana uid
	Name string `json:"name"`
}

// NewCorrelationDataSourceRef creates a new CorrelationDataSourceRef object.
func NewCorrelationDataSourceRef() *CorrelationDataSourceRef {
	return &CorrelationDataSourceRef{}
}

// there was a deprecated field here called type, we will need to move that for conversion and provisioning
// +k8s:openapi-gen=true
type CorrelationConfigSpec struct {
	Field           string                          `json:"field"`
	Target          CorrelationTargetSpec           `json:"target"`
	Transformations []CorrelationTransformationSpec `json:"transformations,omitempty"`
}

// NewCorrelationConfigSpec creates a new CorrelationConfigSpec object.
func NewCorrelationConfigSpec() *CorrelationConfigSpec {
	return &CorrelationConfigSpec{}
}

// +k8s:openapi-gen=true
type CorrelationTargetSpec map[string]interface{}

// +k8s:openapi-gen=true
type CorrelationTransformationSpec struct {
	Type       CorrelationTransformationSpecType `json:"type"`
	Expression string                            `json:"expression"`
	Field      string                            `json:"field"`
	MapValue   string                            `json:"mapValue"`
}

// NewCorrelationTransformationSpec creates a new CorrelationTransformationSpec object.
func NewCorrelationTransformationSpec() *CorrelationTransformationSpec {
	return &CorrelationTransformationSpec{}
}

// +k8s:openapi-gen=true
type CorrelationSpec struct {
	Type        CorrelationCorrelationType `json:"type"`
	Source      CorrelationDataSourceRef   `json:"source"`
	Target      *CorrelationDataSourceRef  `json:"target,omitempty"`
	Description *string                    `json:"description,omitempty"`
	Label       string                     `json:"label"`
	Config      CorrelationConfigSpec      `json:"config"`
}

// NewCorrelationSpec creates a new CorrelationSpec object.
func NewCorrelationSpec() *CorrelationSpec {
	return &CorrelationSpec{
		Source: *NewCorrelationDataSourceRef(),
		Config: *NewCorrelationConfigSpec(),
	}
}

// +k8s:openapi-gen=true
type CorrelationTransformationSpecType string

const (
	CorrelationTransformationSpecTypeRegex  CorrelationTransformationSpecType = "regex"
	CorrelationTransformationSpecTypeLogfmt CorrelationTransformationSpecType = "logfmt"
)
