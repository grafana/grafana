package kinds

// TODO: port the schema from pkg/apis/alertenrichment/v1beta1/types.go
// (Step, Conditional, Matcher, EnricherConfig and the individual enrichers
// should become CUE definitions, ideally in a kinds/v1beta1 package).

alertEnrichmentKind: {
	kind:       "AlertEnrichment"
	pluralName: "AlertEnrichments"
	scope:      "Namespaced"
}

alertEnrichmentv1beta1: alertEnrichmentKind & {
	schema: {
		// TODO: replace with the full AlertEnrichmentSpec.
		spec: {
			title: string
		}
	}
}
