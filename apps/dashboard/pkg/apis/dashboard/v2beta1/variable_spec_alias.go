// This file defines VariableSpec as a hand-written wrapper over the
// DashboardVariableKind union generated in dashboard_spec_gen.go. It exists
// because kinds/globalvariable.cue declares the Variable spec as the union
// type itself (spec: v2.VariableKind), which generates an empty struct that
// post-generate-cleanup removes. The custom
// MarshalJSON/UnmarshalJSON below delegate to the embedded union so the
// wire format matches DashboardVariableKind directly rather than wrapping
// it in an extra object.
package v2beta1

import (
	"bytes"
	"encoding/json"
)

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

	normalized, err := normalizeVariableOptionValues(raw)
	if err != nil {
		return err
	}
	return s.DashboardVariableKind.UnmarshalJSON(normalized)
}

func normalizeVariableOptionValues(raw []byte) ([]byte, error) {
	// Global variable options are generated as string-only unions, but query results can contain numbers.
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var variableKind map[string]any
	if err := decoder.Decode(&variableKind); err != nil {
		return nil, err
	}

	spec, ok := variableKind["spec"].(map[string]any)
	if !ok {
		return raw, nil
	}

	for _, key := range []string{"current", "defaultValue"} {
		normalizeVariableOption(spec[key])
	}

	for _, key := range []string{"options", "staticOptions"} {
		options, ok := spec[key].([]any)
		if !ok {
			continue
		}
		for _, option := range options {
			normalizeVariableOption(option)
		}
	}

	return json.Marshal(variableKind)
}

func normalizeVariableOption(value any) {
	option, ok := value.(map[string]any)
	if !ok {
		return
	}
	switch v := option["value"].(type) {
	case json.Number:
		option["value"] = v.String()
	case []any:
		// Option values may also be an array of strings.
		for i, elem := range v {
			if number, ok := elem.(json.Number); ok {
				v[i] = number.String()
			}
		}
	}
}

var _ json.Marshaler = VariableSpec{}
var _ json.Unmarshaler = (*VariableSpec)(nil)
