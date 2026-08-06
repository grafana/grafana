package v2beta1

// Notebook-only schema types. These live in the dashboard v2beta1 package so they can reuse the
// shared dashboard leaf types (LibraryPanelKind, TimeSettingsSpec, ElementReference) WITHOUT being
// added to DashboardSpec's own element/layout unions. "Share the leaf types, diverge on the
// composition" — the dashboard schema never learns about Cell or NotebookLayout.
//
// A notebook spec is meant to be 1:1 with a dashboard v2 spec apart from the layout, so that no
// NotebookSpec → DashboardSpec bridge is needed. Where dashboard v2beta1 and v2 disagree, the
// notebook follows v2, which is why the panel chain below is forked rather than shared.

// A cell holds non-panel narrative content (markdown text, code) in a notebook layout.
// Panel cells are not represented here — they reuse NotebookPanelKind.
CellKind: {
	kind: "Cell"
	spec: CellSpec
}

CellSpec: {
	content: CellContentKind
}

// Pluggable cell content discriminated by `kind`. New content types are added
// by extending this union with another <Name>CellContentKind member.
CellContentKind: MarkdownCellContentKind | CodeCellContentKind

MarkdownCellContentKind: {
	kind: "Markdown"
	spec: MarkdownCellContentSpec
}

MarkdownCellContentSpec: {
	text: string
}

CodeCellContentKind: {
	kind: "Code"
	spec: CodeCellContentSpec
}

CodeCellContentSpec: {
	language: string
	code:     string
	highlight?: [...int]
	annotation?: string
}

NotebookLayoutKind: {
	kind: "NotebookLayout"
	spec: NotebookLayoutSpec
}

NotebookLayoutSpec: {
	cells: [...NotebookLayoutItemKind]
}

NotebookLayoutItemKind: {
	kind: "NotebookLayoutItem"
	spec: NotebookLayoutItemSpec
}

// One ordered item in a notebook layout. `element` references either a CellKind
// (markdown/code content) or a NotebookPanelKind in the notebook's elements map. `source`
// records who authored the cell; `collapsed` hides the body in the UI.
NotebookLayoutItemSpec: {
	element:    ElementReference
	source:     "assistant" | "user"
	collapsed?: bool
}

// The notebook's own panel chain. It is a copy of the dashboard one down to the transformation,
// which follows the dashboard v2 shape rather than the v2beta1 shape in this package. The chain has
// to be forked rather than shared because PanelKind reaches TransformationKind through
// QueryGroupKind, and those three are what Dashboard v2beta1 serves. Everything the chain does not
// change (DataLink, VizConfigKind, PanelQueryKind, QueryOptionsSpec) stays shared.
NotebookPanelKind: {
	kind: "Panel"
	spec: NotebookPanelSpec
}

NotebookPanelSpec: {
	id:    number
	title: string
	// Shown in a info icon tooltip next to panel title
	description?: string
	// Shown in a sub header below the title.
	subtitle?: string
	links: [...DataLink]
	data:         NotebookQueryGroupKind
	vizConfig:    VizConfigKind
	transparent?: bool
}

NotebookQueryGroupKind: {
	kind: "QueryGroup"
	spec: NotebookQueryGroupSpec
}

NotebookQueryGroupSpec: {
	queries: [...PanelQueryKind]
	transformations: [...NotebookTransformationKind]
	queryOptions: QueryOptionsSpec
}

// Dashboard v2 shape: the transformation ID moved from `kind` to `group`.
NotebookTransformationKind: {
	kind: "Transformation"
	// The group is the transformation ID
	group: string
	spec:  NotebookTransformationSpec
}

// Dashboard v2 shape: no `id`, it is carried by the parent's `group`.
NotebookTransformationSpec: {
	// Disabled transformations are skipped
	disabled?: bool
	// Optional frame matcher. When missing it will be applied to all results
	filter?: MatcherConfig
	// Where to pull DataFrames from as input to transformation
	topic?: DataTopic
	// Options to be passed to the transformer
	// Valid options depend on the transformer id
	options: _
}

// A notebook element is a narrative cell, a panel, or a library panel. Unlike the dashboard
// Element union, this one includes CellKind — and it is referenced ONLY by NotebookSpec.
// CellKind is listed first so it is the generated default (a notebook is narrative-first).
NotebookElement: CellKind | NotebookPanelKind | LibraryPanelKind

// A notebook spec is a dashboard spec with narrative content. It has a title, optional description, tags, time
// settings, and a map of elements (panels and cells) referenced by the layout.
NotebookSpec: {
	title:        string
	description?: string
	tags: [...string] | *[]
	timeSettings: TimeSettingsSpec
	elements: [string]: NotebookElement
	layout: NotebookLayoutKind
}
