import { type ListAlertRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type SourcedLeaf, buildHealthLeaves, buildSharedLeaves, toWhere } from '../rule-search/searchQueryLeaves';

import { type AlertFilterKey, type AlertRuleFilter, DEFAULT_POLICY, STATE_API_VALUES } from './alertRuleFilters';

export function buildAlertRuleSearchQuery(filter: AlertRuleFilter, continueToken?: string) {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where: toWhere(buildAlertRuleLeaves(filter)),
    sort: [{ field: 'title', direction: 'asc' }],
    fields: ALERT_RULE_FIELDS,
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  } satisfies ListAlertRuleSearchRulesV0Alpha1RequestBody;
}

/** The request's leaves in order, each with the filter it came from. */
export function buildAlertRuleLeaves(filter: AlertRuleFilter): Array<SourcedLeaf<AlertFilterKey>> {
  return [...buildSharedLeaves(filter), ...buildRoutingLeaves(filter), ...buildStatusLeaves(filter)];
}

function buildRoutingLeaves(filter: AlertRuleFilter): Array<SourcedLeaf<AlertFilterKey>> {
  const leaves: Array<SourcedLeaf<AlertFilterKey>> = [];

  if (filter.dashboardUid) {
    leaves.push({
      key: 'dashboard',
      leaf: { filter: { field: 'dashboardUID', operator: 'In', values: [filter.dashboardUid] } },
    });
  }
  if (filter.panelId) {
    leaves.push({ key: 'panelId', leaf: { filter: { field: 'panelID', operator: 'In', values: [filter.panelId] } } });
  }
  if (filter.contactPoint) {
    leaves.push({
      key: 'contactPoint',
      leaf: { filter: { field: 'receiver', operator: 'In', values: [filter.contactPoint] } },
    });
  }
  // The default policy needs NotIn on notificationType, which the rule search refuses, so it has no leaf.
  if (filter.policy && filter.policy !== DEFAULT_POLICY) {
    leaves.push({ key: 'policy', leaf: { filter: { field: 'routingTree', operator: 'In', values: [filter.policy] } } });
  }
  if (filter.paused) {
    // NotIn is only accepted on labels, state and health, so "not paused" is paused=false.
    leaves.push({ key: 'paused', leaf: { filter: { field: 'paused', operator: 'In', values: [filter.paused] } } });
  }

  return leaves;
}

function buildStatusLeaves(filter: AlertRuleFilter): Array<SourcedLeaf<AlertFilterKey>> {
  const stateLeaves: Array<SourcedLeaf<AlertFilterKey>> = filter.state
    ? [{ key: 'state', leaf: { filter: { field: 'state', operator: 'In', values: STATE_API_VALUES[filter.state] } } }]
    : [];
  return [...stateLeaves, ...buildHealthLeaves(filter, 'OK')];
}

// `state`, `health`, and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// `annotations` returns as a JSON-encoded string; `interval` is the evaluation cadence.
// `labels` returns as a flat string array ("key" and "key=value" entries); `datasourceUIDs` as a string array.
const ALERT_RULE_FIELDS = [
  'title',
  'folder',
  'paused',
  'state',
  'health',
  'lastError',
  'annotations',
  'interval',
  'labels',
  'datasourceUIDs',
];
