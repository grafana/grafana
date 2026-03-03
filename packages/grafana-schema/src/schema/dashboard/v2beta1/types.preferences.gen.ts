// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface GridLayoutKind {
	kind: "GridLayout";
	spec: GridLayoutSpec;
}

export const defaultGridLayoutKind = (): GridLayoutKind => ({
	kind: "GridLayout",
	spec: defaultGridLayoutSpec(),
});

export interface GridLayoutSpec {
	items: GridLayoutItemKind[];
}

export const defaultGridLayoutSpec = (): GridLayoutSpec => ({
	items: [],
});

export interface GridLayoutItemKind {
	kind: "GridLayoutItem";
	spec: GridLayoutItemSpec;
}

export const defaultGridLayoutItemKind = (): GridLayoutItemKind => ({
	kind: "GridLayoutItem",
	spec: defaultGridLayoutItemSpec(),
});

export interface GridLayoutItemSpec {
	x: number;
	y: number;
	width: number;
	height: number;
	// reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference
	element: ElementReference;
	repeat?: RepeatOptions;
}

export const defaultGridLayoutItemSpec = (): GridLayoutItemSpec => ({
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	element: defaultElementReference(),
});

export interface ElementReference {
	kind: "ElementReference";
	name: string;
}

export const defaultElementReference = (): ElementReference => ({
	kind: "ElementReference",
	name: "",
});

export interface RepeatOptions {
	mode: "variable";
	value: string;
	direction?: "h" | "v";
	maxPerRow?: number;
}

export const defaultRepeatOptions = (): RepeatOptions => ({
	mode: RepeatMode,
	value: "",
});

// other repeat modes will be added in the future: label, frame
export const RepeatMode = "variable";

export interface AutoGridLayoutKind {
	kind: "AutoGridLayout";
	spec: AutoGridLayoutSpec;
}

export const defaultAutoGridLayoutKind = (): AutoGridLayoutKind => ({
	kind: "AutoGridLayout",
	spec: defaultAutoGridLayoutSpec(),
});

export interface AutoGridLayoutSpec {
	maxColumnCount?: number;
	columnWidthMode: "narrow" | "standard" | "wide" | "custom";
	columnWidth?: number;
	rowHeightMode: "short" | "standard" | "tall" | "custom";
	rowHeight?: number;
	fillScreen?: boolean;
	items: AutoGridLayoutItemKind[];
}

export const defaultAutoGridLayoutSpec = (): AutoGridLayoutSpec => ({
	maxColumnCount: 3,
	columnWidthMode: "standard",
	rowHeightMode: "standard",
	fillScreen: false,
	items: [],
});

export interface AutoGridLayoutItemKind {
	kind: "AutoGridLayoutItem";
	spec: AutoGridLayoutItemSpec;
}

export const defaultAutoGridLayoutItemKind = (): AutoGridLayoutItemKind => ({
	kind: "AutoGridLayoutItem",
	spec: defaultAutoGridLayoutItemSpec(),
});

export interface AutoGridLayoutItemSpec {
	element: ElementReference;
	repeat?: AutoGridRepeatOptions;
	conditionalRendering?: ConditionalRenderingGroupKind;
}

export const defaultAutoGridLayoutItemSpec = (): AutoGridLayoutItemSpec => ({
	element: defaultElementReference(),
});

export interface AutoGridRepeatOptions {
	mode: "variable";
	value: string;
}

export const defaultAutoGridRepeatOptions = (): AutoGridRepeatOptions => ({
	mode: RepeatMode,
	value: "",
});

export interface ConditionalRenderingGroupKind {
	kind: "ConditionalRenderingGroup";
	spec: ConditionalRenderingGroupSpec;
}

export const defaultConditionalRenderingGroupKind = (): ConditionalRenderingGroupKind => ({
	kind: "ConditionalRenderingGroup",
	spec: defaultConditionalRenderingGroupSpec(),
});

export interface ConditionalRenderingGroupSpec {
	visibility: "show" | "hide";
	condition: "and" | "or";
	items: (ConditionalRenderingVariableKind | ConditionalRenderingDataKind | ConditionalRenderingTimeRangeSizeKind)[];
}

export const defaultConditionalRenderingGroupSpec = (): ConditionalRenderingGroupSpec => ({
	visibility: "show",
	condition: "and",
	items: [],
});

export interface ConditionalRenderingVariableKind {
	kind: "ConditionalRenderingVariable";
	spec: ConditionalRenderingVariableSpec;
}

export const defaultConditionalRenderingVariableKind = (): ConditionalRenderingVariableKind => ({
	kind: "ConditionalRenderingVariable",
	spec: defaultConditionalRenderingVariableSpec(),
});

export interface ConditionalRenderingVariableSpec {
	variable: string;
	operator: "equals" | "notEquals" | "matches" | "notMatches";
	value: string;
}

export const defaultConditionalRenderingVariableSpec = (): ConditionalRenderingVariableSpec => ({
	variable: "",
	operator: "equals",
	value: "",
});

export interface ConditionalRenderingDataKind {
	kind: "ConditionalRenderingData";
	spec: ConditionalRenderingDataSpec;
}

export const defaultConditionalRenderingDataKind = (): ConditionalRenderingDataKind => ({
	kind: "ConditionalRenderingData",
	spec: defaultConditionalRenderingDataSpec(),
});

export interface ConditionalRenderingDataSpec {
	value: boolean;
}

export const defaultConditionalRenderingDataSpec = (): ConditionalRenderingDataSpec => ({
	value: false,
});

export interface ConditionalRenderingTimeRangeSizeKind {
	kind: "ConditionalRenderingTimeRangeSize";
	spec: ConditionalRenderingTimeRangeSizeSpec;
}

export const defaultConditionalRenderingTimeRangeSizeKind = (): ConditionalRenderingTimeRangeSizeKind => ({
	kind: "ConditionalRenderingTimeRangeSize",
	spec: defaultConditionalRenderingTimeRangeSizeSpec(),
});

export interface ConditionalRenderingTimeRangeSizeSpec {
	value: string;
}

export const defaultConditionalRenderingTimeRangeSizeSpec = (): ConditionalRenderingTimeRangeSizeSpec => ({
	value: "",
});

export interface Preferences {
	// Default layout that would be used when adding new elements
	defaultLayout?: GridLayoutKind | AutoGridLayoutKind;
}

export const defaultPreferences = (): Preferences => ({
});

