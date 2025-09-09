// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CorrelationConfigSpec struct {
	Field           string                          `json:"field"`
	Type            string                          `json:"type"`
	Target          CorrelationTargetSpec           `json:"target"`
	Transformations []CorrelationTransformationSpec `json:"transformations"`
}

// NewCorrelationConfigSpec creates a new CorrelationConfigSpec object.
func NewCorrelationConfigSpec() *CorrelationConfigSpec {
	return &CorrelationConfigSpec{
		Transformations: []CorrelationTransformationSpec{},
	}
}

// +k8s:openapi-gen=true
type CorrelationTargetSpec map[string]interface{}

// +k8s:openapi-gen=true
type CorrelationTransformationSpec struct {
	Type       string `json:"type"`
	Expression string `json:"expression"`
	Field      string `json:"field"`
	MapValue   string `json:"mapValue"`
}

// NewCorrelationTransformationSpec creates a new CorrelationTransformationSpec object.
func NewCorrelationTransformationSpec() *CorrelationTransformationSpec {
	return &CorrelationTransformationSpec{}
}

// +k8s:openapi-gen=true
type CorrelationCorrelationType string

const (
	CorrelationCorrelationTypeQuery    CorrelationCorrelationType = "query"
	CorrelationCorrelationTypeExternal CorrelationCorrelationType = "external"
)

// +k8s:openapi-gen=true
type CorrelationSpec struct {
	SourceUid   string                     `json:"source_uid"`
	TargetUid   string                     `json:"target_uid"`
	Label       string                     `json:"label"`
	Description string                     `json:"description"`
	Config      CorrelationConfigSpec      `json:"config"`
	Provisioned bool                       `json:"provisioned"`
	Type        CorrelationCorrelationType `json:"type"`
}

// NewCorrelationSpec creates a new CorrelationSpec object.
func NewCorrelationSpec() *CorrelationSpec {
	return &CorrelationSpec{
		Config: *NewCorrelationConfigSpec(),
	}
}
