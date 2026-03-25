package v2beta1

import "encoding/json"

// +k8s:openapi-gen=true
type GlobalVariableSpec struct {
	DashboardVariableKind `json:",inline" yaml:",inline"`
}

// NewGlobalVariableSpec creates a default GlobalVariableSpec.
func NewGlobalVariableSpec() *GlobalVariableSpec {
	return &GlobalVariableSpec{
		DashboardVariableKind: *NewDashboardVariableKind(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GlobalVariableSpec.
func (GlobalVariableSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.GlobalVariableSpec"
}

// MarshalJSON delegates to the shared variable union marshaler.
func (s GlobalVariableSpec) MarshalJSON() ([]byte, error) {
	return s.DashboardVariableKind.MarshalJSON()
}

// UnmarshalJSON delegates to the shared variable union unmarshaler.
func (s *GlobalVariableSpec) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}
	return s.DashboardVariableKind.UnmarshalJSON(raw)
}

var _ json.Marshaler = GlobalVariableSpec{}
var _ json.Unmarshaler = (*GlobalVariableSpec)(nil)
