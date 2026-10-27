import { type RuleKind } from '../shared/ruleKind';

import { type RuleSearchFilter } from './ruleSearchFilter';

/** One filter of a page: its help, how a typed value reads into the filter, and feedback on the result. */
export interface FilterDefinition<Kind extends RuleKind = RuleKind> {
  key: FilterKey<Kind>;
  // Text is lazy so it translates when shown.
  label: () => string;
  description: () => string;
  example: string;
  /** The only values the filter accepts, listed when the typed value isn't one of them. */
  values?: string[];
  unavailableValues?: Array<{ value: string; reason: () => string }>;
  /** Reads a non-empty value into `filter`; returns false, leaving `filter` untouched, when it rejects the value. */
  apply: (filter: RuleSearchFilter, value: string) => boolean;
  /** Judges the parsed filter, so it can read other filters: `panelId:` needs `dashboard:`. */
  feedback?: (filter: RuleSearchFilter) => 'invalid' | 'unavailable' | undefined;
  /** Old values, in lowercase, and the values that replace them; the search suggests the new one. */
  renamedValues?: Record<string, string>;
}

/** The keys a page of `Kind` supports; without `Kind`, the keys of either page. */
export type FilterKey<Kind extends RuleKind = RuleKind> = FilterKeysByKind[Kind];

export type SharedFilterKey = 'rule' | 'folder' | 'datasource' | 'label' | 'plugins' | 'health';

interface FilterKeysByKind {
  alert: SharedFilterKey | 'state' | 'dashboard' | 'panelId' | 'contactPoint' | 'policy' | 'paused';
  recording: SharedFilterKey | 'metric' | 'targetDatasource';
}

export function indexByKey(definitions: FilterDefinition[]): Map<string, FilterDefinition> {
  return new Map(definitions.map((definition) => [definition.key, definition]));
}
