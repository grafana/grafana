package v0alpha1

import (
	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

// When writing values, only one property is valid at a time
// When reading, GUID will always be set, the Value+Ref *may* be set
type SecureValue struct {
	// GUID is a unique identifier for this exact field
	// it must match the same group+resource+namespace+name where it was created
	GUID string `json:"guid,omitempty"`

	// The raw non-encrypted value
	// Used when writing new values, or reading decrypted values
	Value string `json:"value,omitempty"`

	// Used when linking this value to a known (and authorized) reference id
	// Enterprise only????
	Ref string `json:"ref,omitempty"`
}

// Check if oneOf GUID|Value|Ref is populated
func (v SecureValue) IsValidForWrite() bool {
	if v.GUID != "" {
		return v.Value == "" && v.Ref == ""
	}
	if v.Value != "" {
		return v.Ref == ""
	}
	return v.Ref != ""
}

// Produce an API definition for secure values (that includes the OneOf detail)
func (v SecureValue) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:        []string{"object"},
				Description: "secure value",
				OneOf: []spec.Schema{{
					SchemaProps: spec.SchemaProps{
						Type:        []string{"object"},
						Description: "GUID is a unique identifier for this exact field.  It must match the same group+resource+namespace+name where it was created",
						Properties: map[string]spec.Schema{
							"guid": *spec.StringProperty(),
						},
					},
				}, {
					SchemaProps: spec.SchemaProps{
						Type:        []string{"object"},
						Description: "The raw non-encrypted value",
						Properties: map[string]spec.Schema{
							"value": *spec.StringProperty(),
						},
					},
				}, {
					SchemaProps: spec.SchemaProps{
						Type:        []string{"object"},
						Description: "A shared secure value (enterprise only)",
						Properties: map[string]spec.Schema{
							"ref": *spec.StringProperty(),
						},
					},
				}},
			},
		},
	}
}
