/**
 * A string selector
 */

export type StringSelector = string;

/**
 * A function selector with an argument
 */
export type FunctionSelector = (id: string) => string;

/**
 * A function selector without argument
 */
export type CssSelector = () => string;

export interface Selectors {
  [key: string]: StringSelector | FunctionSelector | CssSelector | UrlSelector | Selectors;
}

export type E2ESelectors<S extends Selectors> = {
  [P in keyof S]: S[P];
};

export interface UrlSelector extends Selectors {
  url: string | FunctionSelector;
}

export type VersionedFunctionSelector = Record<string, FunctionSelector>;

export type VersionedStringSelector = Record<string, StringSelector>;

export type VersionedSelectorGroup = {
  [property: string]: VersionedFunctionSelector | VersionedStringSelector | VersionedSelectorGroup;
};
