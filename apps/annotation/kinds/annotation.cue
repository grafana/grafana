package kinds

#AnnotationSpec: {
	// Text of the annotation.
	text: string
	// Start time of the annotation, in Unix milliseconds.
	time: int64
	// End time of the annotation, in Unix milliseconds.
	// Optional. Set it to make the annotation a region.
	timeEnd?: int64
	// UID of the dashboard the annotation belongs to.
	// Optional. Omit it for an organization-wide annotation.
	dashboardUID?: string
	// ID of the panel the annotation belongs to, within the dashboard set by dashboardUID.
	// Optional. Omit it to show the annotation on every panel of the dashboard.
	panelID?: int64
	// Tags used to categorize and filter annotations.
	tags?: [...string]
	// Names of the scopes the annotation applies to.
	scopes?: [...string]
}

annotationv0alpha1: {
	kind:       "Annotation"
	pluralName: "Annotations"
	schema: {
		spec: #AnnotationSpec
	}
	selectableFields: [
		"spec.time",
		"spec.timeEnd",
		"spec.dashboardUID",
		"spec.panelID",
	]
}
