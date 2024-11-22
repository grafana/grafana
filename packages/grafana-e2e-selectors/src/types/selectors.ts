/**
 * A string selector
 */

export type StringSelector = string;

/**
 * A function selector with one argument
 */
export type FunctionSelector = (id: string) => string;

/**
 * A function selector with two arguments
 */
export type FunctionSelectorTwoArgs = (arg1: string, arg2: string) => string;

/**
 * A function selector without argument
 */
export type CssSelector = () => string;

export interface Selectors {
  [key: string]: StringSelector | FunctionSelector | FunctionSelectorTwoArgs | CssSelector | UrlSelector | Selectors;
}

export type E2ESelectors<S extends Selectors> = {
  [P in keyof S]: S[P];
};

export interface UrlSelector extends Selectors {
  url: string | FunctionSelector;
}

export type VersionedFunctionSelector1 = Record<string, FunctionSelector>;

export type VersionedFunctionSelector2 = Record<string, FunctionSelectorTwoArgs>;

export type VersionedStringSelector = Record<string, StringSelector>;

export type VersionedCssSelector = Record<string, CssSelector>;

export type VersionedUrlSelector = Record<string, UrlSelector>;

export type VersionedSelectors =
  | VersionedFunctionSelector1
  | VersionedFunctionSelector2
  | VersionedStringSelector
  | VersionedCssSelector
  | VersionedUrlSelector;

export type VersionedSelectorGroup = {
  [property: string]: VersionedSelectors | VersionedSelectorGroup;
};

export type SelectorsOf<T> = {
  [Property in keyof T]: T[Property] extends VersionedFunctionSelector1
    ? FunctionSelector
    : T[Property] extends VersionedFunctionSelector2
      ? FunctionSelectorTwoArgs
      : T[Property] extends VersionedStringSelector
        ? StringSelector
        : T[Property] extends VersionedCssSelector
          ? CssSelector
          : T[Property] extends VersionedUrlSelector
            ? UrlSelector
            : SelectorsOf<T[Property]>;
};
