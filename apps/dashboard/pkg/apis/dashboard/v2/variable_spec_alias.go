// This file defines VariableSpec as a hand-written wrapper over the
// DashboardVariableKind union generated in dashboard_spec_gen.go. It exists
// because kinds/globalvariable.cue declares the Variable spec as the union
// type itself (spec: v2.VariableKind), which leaves the auto-generated
// variable_spec_gen.go as an empty package-declaration stub. The custom
// MarshalJSON/UnmarshalJSON below delegate to the embedded union so the
// wire format matches DashboardVariableKind directly rather than wrapping
// it in an extra object.
package v2

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
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2.VariableSpec"
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
