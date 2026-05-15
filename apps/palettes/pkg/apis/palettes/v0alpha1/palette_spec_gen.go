// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// PaletteVisibility identifies a principal that can READ the palette.
// Format mirrors pkg/registry/apis/preferences/utils.OwnerReference.AsName():
//
//	"org"               -> visible to everyone in the namespace (org)
//	"user-<userUID>"    -> visible to that user
//	"team-<teamUID>"    -> visible to members of that team
//
// +k8s:openapi-gen=true
type PalettePaletteVisibility string

// +k8s:openapi-gen=true
type PaletteSpec struct {
	// Stable panel-referenceable id (slug). Stored in dashboard JSON as
	// fieldConfig.defaults.color.mode. Must equal the trailing segment
	// of metadata.name (validated by admission). Example: "sunset".
	Id string `json:"id"`
	// UI display name. Example: "Sunset".
	DisplayName string `json:"displayName"`
	// Optional UI grouping for the palette picker. Example: "Custom".
	Group *string `json:"group,omitempty"`
	// Ordered list of color values. Same shape as today's
	// localStorage.getItem("grafana.dynamicPalette.<id>").
	// +listType=atomic
	Colors []string `json:"colors"`
	// Additional scopes that may READ this palette beyond the owner.
	// The owner (derived from metadata.name) is always implicitly allowed
	// and does not need to be repeated here.
	// Empty (default) means "owner-only".
	// +listType=set
	ShareWith []PalettePaletteVisibility `json:"shareWith"`
}

// NewPaletteSpec creates a new PaletteSpec object.
func NewPaletteSpec() *PaletteSpec {
	return &PaletteSpec{
		Colors:    []string{},
		ShareWith: []PalettePaletteVisibility{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PaletteSpec.
func (PaletteSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.palettes.pkg.apis.palettes.v0alpha1.PaletteSpec"
}
