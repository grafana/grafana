import { type SharedRuleFilter } from './sharedRuleFilter';

/** A page's search: its filters, in the order the help lists them, and the filter they read into. */
export interface RuleSearchSchema<Filter extends SharedRuleFilter, Key extends string = string> {
  filters: Array<FilterDefinition<Filter, Key>>;
  createEmptyFilter: () => Filter;
}

/**
 * One filter of a page: its help, how a typed value reads into the page's filter, and feedback on the result.
 * `Key` is the page's key union, so a definition can't join a page that has no such filter.
 */
export interface FilterDefinition<Filter extends SharedRuleFilter, Key extends string = string> extends FilterHelp {
  key: Key;
  /** Reads a non-empty value into `filter`; returns false, leaving `filter` untouched, when it rejects the value. */
  apply: (filter: Filter, value: string) => boolean;
  /** Judges the parsed filter, so a filter can depend on another one of the page. */
  feedback?: (filter: Filter) => 'invalid' | 'unavailable' | undefined;
  /** Old values, in lowercase, and the values that replace them; the search suggests the new one. */
  renamedValues?: Record<string, string>;
}

/** What the search input shows for a filter. Text is lazy so it translates when shown. */
export interface FilterHelp {
  key: string;
  label: () => string;
  description: () => string;
  example: string;
  /** The only values the filter accepts, listed when the typed value isn't one of them. */
  values?: string[];
  unavailableValues?: Array<{ value: string; reason: () => string }>;
}
