package palettes

paletteV0alpha1: {
	kind:       "Palette"
	pluralName: "Palettes"
	scope:      "Namespaced"

	validation: {operations: ["CREATE", "UPDATE"]}

	schema: {
		// PaletteVisibility identifies a principal that can READ the palette.
		// Format mirrors pkg/registry/apis/preferences/utils.OwnerReference.AsName():
		//   "org"               -> visible to everyone in the namespace (org)
		//   "user-<userUID>"    -> visible to that user
		//   "team-<teamUID>"    -> visible to members of that team
		#PaletteVisibility: string

		spec: {
			// Stable panel-referenceable id (slug). Stored in dashboard JSON as
			// fieldConfig.defaults.color.mode. Must equal the trailing segment
			// of metadata.name (validated by admission). Example: "sunset".
			id: string

			// UI display name. Example: "Sunset".
			displayName: string

			// Optional UI grouping for the palette picker. Example: "Custom".
			group?: string

			// Ordered list of color values. Same shape as today's
			// localStorage.getItem("grafana.dynamicPalette.<id>").
			// +listType=atomic
			colors: [...string]

			// Additional scopes that may READ this palette beyond the owner.
			// The owner (derived from metadata.name) is always implicitly allowed
			// and does not need to be repeated here.
			// Empty (default) means "owner-only".
			// +listType=set
			shareWith: [...#PaletteVisibility] | *[]
		}
	}
}
