/**
 * A string selector
 *
 * @alpha
 */

export type StringSelector = string;

/**
 * A function selector with an argument
 *
 * @alpha
 */
export type FunctionSelector = (id: string) => string;

/**
 * A function selector without argument
 *
 * @alpha
 */
export type CssSelector = () => string;

/**
 * @alpha
 */
export interface Selectors {
  [key: string]: StringSelector | FunctionSelector | CssSelector | UrlSelector | Selectors;
}

/**
 * @alpha
 */
export type E2ESelectors<S extends Selectors> = {
  [P in keyof S]: S[P];
};

/**
 * @alpha
 */
export interface UrlSelector extends Selectors {
  url: string | FunctionSelector;
}
