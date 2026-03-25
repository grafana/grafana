package v2beta1

import "encoding/json"

// +k8s:openapi-gen=true
type VariableSpec struct {
	DashboardVariableKind `json:",inline" yaml:",inline"`
}

// NewVariableSpec creates a default VariableSpec.
func NewVariableSpec() *VariableSpec {
	return &VariableSpec{
		DashboardVariableKind: *NewDashboardVariableKind(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for VariableSpec.
func (VariableSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.VariableSpec"
}

// MarshalJSON delegates to the shared variable union marshaler.
func (s VariableSpec) MarshalJSON() ([]byte, error) {
	return s.DashboardVariableKind.MarshalJSON()
}

// UnmarshalJSON delegates to the shared variable union unmarshaler.
func (s *VariableSpec) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}
	return s.DashboardVariableKind.UnmarshalJSON(raw)
}

var _ json.Marshaler = VariableSpec{}
var _ json.Unmarshaler = (*VariableSpec)(nil)
