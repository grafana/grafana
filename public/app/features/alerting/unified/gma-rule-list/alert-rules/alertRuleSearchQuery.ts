import { type Criteria } from '../rule-search/criteria';
import {
  type BuildSearchQueryOptions,
  DEFAULT_LIMIT,
  type SearchQuery,
  type SearchQueryLeaf,
  buildSharedLeaves,
  toWhere,
} from '../rule-search/searchQueryLeaves';

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
