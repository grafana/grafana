import { type ListAlertRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { DEFAULT_POLICY, type RuleSearchFilter, type StateValue } from '../rule-search/ruleSearchFilter';
import { type SearchQueryLeaf, buildHealthLeaves, buildSharedLeaves, toWhere } from '../rule-search/searchQueryLeaves';

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
  'totalsHealthy',
  'totalsFiring',
  'totalsPending',
  'totalsRecovering',
  'totalsNoData',
  'totalsError',
];

/** `normal` and `inactive` both mean no firing, pending or recovering instance. */
const STATE_API_VALUES: Record<StateValue, string[]> = {
  firing: ['Firing'],
  pending: ['Pending'],
  recovering: ['Recovering'],
  normal: ['Healthy', 'Inactive'],
  inactive: ['Healthy', 'Inactive'],
};

function buildStatusLeaves(filter: RuleSearchFilter): SearchQueryLeaf[] {
  const stateLeaves: SearchQueryLeaf[] = filter.state
    ? [{ filter: { field: 'state', operator: 'In', values: STATE_API_VALUES[filter.state] } }]
    : [];
  return [...stateLeaves, ...buildHealthLeaves(filter, 'OK')];
}

function buildRoutingLeaves(filter: RuleSearchFilter): SearchQueryLeaf[] {
  const leaves: SearchQueryLeaf[] = [];

  if (filter.dashboardUid) {
    leaves.push({ filter: { field: 'dashboardUID', operator: 'In', values: [filter.dashboardUid] } });
  }

  // Panel IDs are dashboard-local: only filter by panel when a dashboard is selected.
  if (filter.panelId && filter.dashboardUid) {
    leaves.push({ filter: { field: 'panelID', operator: 'In', values: [filter.panelId] } });
  }

  // policy wins over contactPoint. 'default' has no request form (needs NotIn on
  // notificationType), so getFilterIssues reports it and it is never sent.
  if (filter.policy && filter.policy !== DEFAULT_POLICY) {
    leaves.push({ filter: { field: 'routingTree', operator: 'In', values: [filter.policy] } });
  } else if (!filter.policy && filter.contactPoint) {
    leaves.push({ filter: { field: 'receiver', operator: 'In', values: [filter.contactPoint] } });
  }

  if (filter.paused) {
    // NotIn is only accepted on labels, state and health, so "not paused" is paused=false.
    leaves.push({ filter: { field: 'paused', operator: 'In', values: [filter.paused] } });
  }

  return leaves;
}

export function buildAlertRuleSearchQuery(filter: RuleSearchFilter, continueToken?: string) {
  const leaves = [...buildSharedLeaves(filter), ...buildRoutingLeaves(filter), ...buildStatusLeaves(filter)];

  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where: toWhere(leaves),
    sort: [{ field: 'title', direction: 'asc' }],
    fields: ALERT_RULE_FIELDS,
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  } satisfies ListAlertRuleSearchRulesV0Alpha1RequestBody;
}
