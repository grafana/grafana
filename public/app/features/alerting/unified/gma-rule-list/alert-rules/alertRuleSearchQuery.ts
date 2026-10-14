import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type Criteria, DEFAULT_POLICY, type StateValue } from '../rule-search/criteria';
import {
  type BuildSearchQueryOptions,
  type SearchQuery,
  type SearchQueryLeaf,
  buildHealthLeaves,
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

/** `normal` and `inactive` both meant "no firing, pending or recovering instance": `Healthy` is an
 * evaluated Normal state and `Inactive` is a paused rule or one with no instance states. */
const STATE_API_VALUES: Record<StateValue, string[]> = {
  firing: ['Firing'],
  pending: ['Pending'],
  recovering: ['Recovering'],
  normal: ['Healthy', 'Inactive'],
  inactive: ['Healthy', 'Inactive'],
};

function buildStatusLeaves(criteria: Criteria): SearchQueryLeaf[] {
  const stateLeaves: SearchQueryLeaf[] = criteria.state
    ? [{ filter: { field: 'state', operator: 'In', values: STATE_API_VALUES[criteria.state] } }]
    : [];
  return [...stateLeaves, ...buildHealthLeaves(criteria, 'OK')];
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
  // somehow carries both. The reserved value 'default' has no accepted request form (it would
  // need a NotIn on notificationType), so it is reported by getCriteriaIssues and never sent.
  if (criteria.policy && criteria.policy !== DEFAULT_POLICY) {
    leaves.push({ filter: { field: 'routingTree', operator: 'In', values: [criteria.policy] } });
  } else if (!criteria.policy && criteria.contactPoint) {
    leaves.push({ filter: { field: 'receiver', operator: 'In', values: [criteria.contactPoint] } });
  }

  if (criteria.paused) {
    // NotIn is only accepted on labels, state and health, so "not paused" is an explicit
    // paused=false rather than the complement of paused=true.
    leaves.push({ filter: { field: 'paused', operator: 'In', values: [criteria.paused] } });
  }

  return leaves;
}

export function buildAlertRuleSearchQuery(criteria: Criteria, options: BuildSearchQueryOptions = {}): SearchQuery {
  const leaves = [...buildSharedLeaves(criteria), ...buildRoutingLeaves(criteria), ...buildStatusLeaves(criteria)];

  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where: toWhere(leaves),
    sort: [{ field: 'title', direction: 'asc' }],
    fields: ALERT_RULE_FIELDS,
    limit: options.limit ?? DEFAULT_PER_PAGE_PAGINATION,
    ...(options.continue ? { continue: options.continue } : {}),
  };
}
