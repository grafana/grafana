import { type Criteria } from './types';

/**
 * Structural type for the generic `search.grafana.app` SearchQuery request body. No
 * generated client type exists yet for `/alertrules/search` / `/recordingrules/search` —
 * `generate-rtk-apis.ts` currently skips per-resource `/search` routes. Once that client is
 * regenerated, this local type should be swapped for the generated one; the shape here
 * matches it field for field so that swap should be a type-only change.
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

export interface SearchQuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export type SearchQueryNode = SearchQueryLeaf | { and: SearchQueryLeaf[] };

export type SearchQueryLeaf = { text: { value: string } } | { filter: SearchQueryFilter } | { regex: SearchQueryRegex };

export interface SearchQueryFilter {
  field: string;
  operator: 'In' | 'NotIn' | 'All';
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

const DEFAULT_LIMIT = 40;

const ALERT_RULE_FIELDS = [
  'title',
  'folder',
  'paused',
  'labels',
  'annotations',
  'datasourceUIDs',
  'interval',
  'notificationType',
  'receiver',
  'routingTree',
  'dashboardUID',
  'panelID',
  // status fields — see apps/alerting/rules/kinds/alertRule.cue searchFields
  'health',
  'state',
  'stateReason',
  'lastEvaluationTime',
  'evaluationDuration',
  'lastError',
];

const RECORDING_RULE_FIELDS = [
  'title',
  'folder',
  'paused',
  'labels',
  'datasourceUIDs',
  'interval',
  'metric',
  'targetDatasourceUID',
  // status fields — see apps/alerting/rules/kinds/recordingRule.cue searchFields (recording
  // rules have no "state": they have no firing/pending notion, only health)
  'health',
  'lastEvaluationTime',
  'evaluationDuration',
  'lastError',
];

/** Builds the shared leaves: text, folders, query data sources, labels, plugin-origin. */
function buildSharedLeaves(criteria: Criteria): SearchQueryLeaf[] {
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
    leaves.push({ filter: { field: 'labels', operator: 'NotIn', values: ['__grafana_origin'] } });
  }

  // criteria.state / criteria.health are intentionally never turned into leaves: filtering
  // on these fields is not deployed yet, so sending them would silently return zero (or
  // wrong) results.

  return leaves;
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

function buildRoutingLeaves(criteria: Criteria): SearchQueryLeaf[] {
  const leaves: SearchQueryLeaf[] = [];

  if (criteria.dashboardUid) {
    leaves.push({ filter: { field: 'dashboardUID', operator: 'In', values: [criteria.dashboardUid] } });
  }

  // Panel IDs are dashboard-local: only filter by panel when a dashboard is also selected,
  // otherwise the ID is ambiguous.
  if (criteria.panelId && criteria.dashboardUid) {
    leaves.push({ filter: { field: 'panelID', operator: 'In', values: [criteria.panelId] } });
  }

  // policy: and contactPoint: are mutually exclusive in the UI; policy wins if a query
  // somehow carries both (mirrors the legacy buildRoutingFilter precedence).
  if (criteria.policy === 'default') {
    // Candidate mapping, not yet verified against fixtures: default-policy rules have
    // neither notification type, so excluding both explicit types should select them.
    leaves.push({
      filter: { field: 'notificationType', operator: 'NotIn', values: ['SimplifiedRouting', 'NamedRoutingTree'] },
    });
  } else if (criteria.policy) {
    leaves.push({ filter: { field: 'routingTree', operator: 'In', values: [criteria.policy] } });
  } else if (criteria.contactPoint) {
    leaves.push({ filter: { field: 'receiver', operator: 'In', values: [criteria.contactPoint] } });
  }

  if (criteria.paused === 'true') {
    leaves.push({ filter: { field: 'paused', operator: 'In', values: ['true'] } });
  } else if (criteria.paused === 'false') {
    // NotIn ["true"] also matches rules where the optional paused field is absent, which is
    // what "not paused" should mean.
    leaves.push({ filter: { field: 'paused', operator: 'NotIn', values: ['true'] } });
  }

  return leaves;
}

function buildRecordingOnlyLeaves(criteria: Criteria): SearchQueryLeaf[] {
  const leaves: SearchQueryLeaf[] = [];

  if (criteria.metric) {
    leaves.push({ filter: { field: 'metric', operator: 'In', values: [criteria.metric] } });
  }
  if (criteria.targetDataSourceUid) {
    leaves.push({ filter: { field: 'targetDatasourceUID', operator: 'In', values: [criteria.targetDataSourceUid] } });
  }

  return leaves;
}

function toWhere(leaves: SearchQueryLeaf[]): SearchQueryNode | undefined {
  if (leaves.length === 0) {
    return undefined;
  }
  if (leaves.length === 1) {
    return leaves[0];
  }
  return { and: leaves };
}

export function buildAlertRuleSearchQuery(criteria: Criteria, options: BuildSearchQueryOptions = {}): SearchQuery {
  const leaves = [...buildSharedLeaves(criteria), ...buildRoutingLeaves(criteria)];

  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where: toWhere(leaves),
    sort: [{ field: 'title', direction: 'asc' }],
    fields: ALERT_RULE_FIELDS,
    limit: options.limit ?? DEFAULT_LIMIT,
    ...(options.continue ? { continue: options.continue } : {}),
  };
}

export function buildRecordingRuleSearchQuery(criteria: Criteria, options: BuildSearchQueryOptions = {}): SearchQuery {
  const leaves = [...buildSharedLeaves(criteria), ...buildRecordingOnlyLeaves(criteria)];

  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where: toWhere(leaves),
    sort: [{ field: 'title', direction: 'asc' }],
    fields: RECORDING_RULE_FIELDS,
    limit: options.limit ?? DEFAULT_LIMIT,
    ...(options.continue ? { continue: options.continue } : {}),
  };
}
