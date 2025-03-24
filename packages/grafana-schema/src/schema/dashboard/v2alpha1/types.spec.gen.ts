// Code generated - EDITING IS FUTILE. DO NOT EDIT.

import * as v2alpha1 from '../v2alpha1';


export type ValueMapping = ValueMap | RangeMap;

export const defaultValueMapping = (): ValueMapping => (defaultValueMap());

// Maps text values to a color or different display text and color.
// For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
export interface ValueMap {
	type: unknown;
	// Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } }
	options: Record<string, ValueMappingResult>;
}

export const defaultValueMap = (): ValueMap => ({
	type: "unknown",
	options: {},
});

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
export type MappingType = "value" | "range" | "regex" | "special";

export const defaultMappingType = (): MappingType => ("value");

// Result used as replacement with text and color when the value matches
export interface ValueMappingResult {
	// Text to display when the value matches
	text?: string;
	// Text to use when the value matches
	color?: string;
	// Icon to display when the value matches. Only specific visualizations.
	icon?: string;
	// Position in the mapping array. Only used internally.
	index?: number;
}

export const defaultValueMappingResult = (): ValueMappingResult => ({
});

// Maps numerical ranges to a display text and color.
// For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
export interface RangeMap {
	type: unknown;
	// Range to match against and the result to apply when the value is within the range
	options: {
		// Min value of the range. It can be null which means -Infinity
		from: number | null;
		// Max value of the range. It can be null which means +Infinity
		to: number | null;
		// Config to apply when the value is within the range
		result: ValueMappingResult;
	};
}

export const defaultRangeMap = (): RangeMap => ({
	type: "unknown",
	options: {
	from: 0,
	to: 0,
	result: defaultValueMappingResult(),
},
});

export interface Spec {
	mappings?: ValueMapping[];
}

export const defaultSpec = (): Spec => ({
});

