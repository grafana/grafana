package advisor

checktypev0alpha1: {
	kind:   "CheckType"
	plural: "checktypes"
	scope:  "Namespaced"
	schema: {
		// A named URL that the frontend substitutes into a description/resolution
		// template via i18next's <Trans> component. The template refers to the
		// link by name (e.g. "<docs>text</docs>"), so translators never see or
		// touch URLs — they stay in code alongside the check.
		#Link: {
			name: string
			url:  string
		}
		#Step: {
			title: string
			// description may be a template containing named placeholders like
			// "{{version}}" for values (see descriptionArgs) and "<docs>text</docs>"
			// for links (see descriptionLinks). Frontend interpolates via
			// @grafana/i18n's t()/<Trans>.
			description: string
			// Values substituted into description placeholders like "{{name}}".
			// Names that must NOT be translated (product names, IDs, versions)
			// belong here, not inline in the description text.
			descriptionArgs?: [string]: string
			// Named URLs substituted into description via i18next <Trans> tags.
			descriptionLinks?: [...#Link]
			stepID: string
			// resolution follows the same template + args + links contract as
			// description above.
			resolution:       string
			resolutionArgs?:  [string]: string
			resolutionLinks?: [...#Link]
		}
		spec: {
			name: string
			steps: [...#Step]
		}
	}
}
