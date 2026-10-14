import { type Criteria, type HealthValue } from './criteria';

/**
 * Structural type for the `search.grafana.app` SearchQuery body the per-kind rule search
 * endpoints accept. It is deliberately independent of the generated request types so the
 * builders stay valid for whichever endpoint the transport modules pick; the generated body
 * types accept it field for field.
 *
 * The per-kind rule search accepts one leaf or one flat `and`; filters (In, and NotIn only on
 * labels, state and health) with exactly one value on every field except folder, datasource
 * UIDs, state and health; regex on labels only; a single title text leaf; and title sort. The
 * builders stay inside that subset, and criteriaIssues.ts reports criteria that cannot.
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

/** The part of a search hit the row mappers read: the rule UID and the projected field bag. */
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
  /** Matches how a single Prometheus matcher works: `negate: true` is `!~` — see
   * pkg/registry/apis/search/README.md. */
  negate?: boolean;
}

export interface BuildSearchQueryOptions {
  limit?: number;
  continue?: string;
}

/** Builds the shared leaves: text, folders, query data sources, labels, plugin-managed rules. */
export function buildSharedLeaves(criteria: Criteria): SearchQueryLeaf[] {
  const leaves: SearchQueryLeaf[] = [];

  // Free text and rule: mean the same thing (a title search), so they share one text leaf.
  const text = criteria.text.join(' ').trim();
  if (text.length > 0) {
    leaves.push({ text: { value: text } });
  }

  if (criteria.namespaces.length > 0) {
    leaves.push({ filter: { field: 'folder', operator: 'In', values: criteria.namespaces } });
  }

  if (criteria.dataSourceUids.length > 0) {
    leaves.push({ filter: { field: 'datasourceUIDs', operator: 'In', values: criteria.dataSourceUids } });
  }

  for (const label of criteria.labels) {
    leaves.push(...buildLabelLeaves(label));
  }

  if (criteria.hidePluginRules) {
    // Only an origin that starts with `plugin/` marks a plugin-managed rule, and a rule without
    // the label counts as an empty value, so it is kept.
    leaves.push({ regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } });
  }

  return leaves;
}

/** The API's health values by token spelling. `ok` differs by kind: Recording rules report
 * `Recording` where Alert rules report `OK`. */
const HEALTH_API_VALUES: Record<Exclude<HealthValue, 'ok'>, string> = {
  nodata: 'NoData',
  error: 'Error',
  err: 'Error',
  unknown: 'Unknown',
};

/** `In` never matches a rule with no stored status, so a health filter hides those rules. */
export function buildHealthLeaves(criteria: Criteria, okValue: 'OK' | 'Recording'): SearchQueryLeaf[] {
  if (!criteria.health) {
    return [];
  }
  const value = criteria.health === 'ok' ? okValue : HEALTH_API_VALUES[criteria.health];
  return [{ filter: { field: 'health', operator: 'In', values: [value] } }];
}

function buildLabelLeaves(label: Criteria['labels'][number]): SearchQueryLeaf[] {
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
      // Empty-value caveat: pattern `key=` matches empty-or-missing values, but exact
      // `In`/`NotIn` inclusion cannot express that — so a regex leaf is the only way to
      // match "key present with any/no value" via a pattern.
      return [{ regex: { field: 'labels', pattern: `${label.key}=${label.value ?? ''}` } }];
    case 'notRegex':
      // negate mirrors a single Prometheus matcher's `!~` — see
      // pkg/registry/apis/search/README.md.
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
