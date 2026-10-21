import { type HealthValue, type RuleSearchFilter } from './ruleSearchFilter';

/**
 * Structural SearchQuery body, independent of the generated request types. The per-kind rule
 * search accepts one leaf or one flat `and`; filters (In, and NotIn only on labels, state and
 * health) with exactly one value except on folder, datasource UIDs, state and health; regex on
 * labels only; a single title text leaf; and title sort. Builders stay inside that subset.
 */
export interface SearchQuery {
  apiVersion: 'search.grafana.app/v0alpha1';
  kind: 'SearchQuery';
  where?: SearchQueryNode;
  sort: SearchQuerySort[];
  fields: string[];
  limit: number;
  continue?: string;
}

export interface RuleSearchResultItem {
  resource: { name: string };
  fields?: Record<string, unknown>;
}

export interface SearchQuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export type SearchQueryNode = SearchQueryLeaf | { and: SearchQueryLeaf[] };

export type SearchQueryLeaf = { text: { value: string } } | { filter: SearchQueryFilter } | { regex: SearchQueryRegex };

export interface SearchQueryFilter {
  field: string;
  operator: 'In' | 'NotIn';
  values: string[];
}

export interface SearchQueryRegex {
  field: string;
  pattern: string;
  /** Mirrors a Prometheus matcher: `negate: true` is `!~`. */
  negate?: boolean;
}

export interface BuildSearchQueryOptions {
  limit?: number;
  continue?: string;
}

export function buildSharedLeaves(filter: RuleSearchFilter): SearchQueryLeaf[] {
  const leaves: SearchQueryLeaf[] = [];

  const text = filter.text.join(' ').trim();
  if (text.length > 0) {
    leaves.push({ text: { value: text } });
  }

  if (filter.namespaces.length > 0) {
    leaves.push({ filter: { field: 'folder', operator: 'In', values: filter.namespaces } });
  }

  if (filter.dataSourceUids.length > 0) {
    leaves.push({ filter: { field: 'datasourceUIDs', operator: 'In', values: filter.dataSourceUids } });
  }

  for (const label of filter.labels) {
    leaves.push(...buildLabelLeaves(label));
  }

  if (filter.hidePluginRules) {
    // Only an origin that starts with `plugin/` marks a plugin-managed rule, and a rule without
    // the label counts as an empty value, so it is kept.
    leaves.push({ regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } });
  }

  return leaves;
}

/** `ok` differs by kind: Recording rules report `Recording`, Alert rules `OK`. */
const HEALTH_API_VALUES: Record<Exclude<HealthValue, 'ok'>, string> = {
  nodata: 'NoData',
  error: 'Error',
  err: 'Error',
  unknown: 'Unknown',
};

/** `In` never matches a rule with no stored status, so a health filter hides those rules. */
export function buildHealthLeaves(filter: RuleSearchFilter, okValue: 'OK' | 'Recording'): SearchQueryLeaf[] {
  if (!filter.health) {
    return [];
  }
  const value = filter.health === 'ok' ? okValue : HEALTH_API_VALUES[filter.health];
  return [{ filter: { field: 'health', operator: 'In', values: [value] } }];
}

function buildLabelLeaves(label: RuleSearchFilter['labels'][number]): SearchQueryLeaf[] {
  switch (label.operator) {
    case 'exists':
      return [{ filter: { field: 'labels', operator: 'In', values: [label.key] } }];
    case 'absent':
      return [{ filter: { field: 'labels', operator: 'NotIn', values: [label.key] } }];
    case 'equal':
      return [{ filter: { field: 'labels', operator: 'In', values: [`${label.key}=${label.value ?? ''}`] } }];
    case 'notEqual':
      return [{ filter: { field: 'labels', operator: 'NotIn', values: [`${label.key}=${label.value ?? ''}`] } }];
    case 'regex':
      // `In`/`NotIn` cannot express "key present with any/no value", so only a regex leaf can.
      return [{ regex: { field: 'labels', pattern: `${label.key}=${label.value ?? ''}` } }];
    case 'notRegex':
      return [{ regex: { field: 'labels', pattern: `${label.key}=${label.value ?? ''}`, negate: true } }];
  }
}

export function toWhere(leaves: SearchQueryLeaf[]): SearchQueryNode | undefined {
  if (leaves.length === 0) {
    return undefined;
  }
  if (leaves.length === 1) {
    return leaves[0];
  }
  return { and: leaves };
}
