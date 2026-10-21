import { type ListRecordingRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type RuleSearchFilter } from '../rule-search/ruleSearchFilter';
import {
  type BuildSearchQueryOptions,
  type SearchQueryLeaf,
  buildHealthLeaves,
  buildSharedLeaves,
  toWhere,
} from '../rule-search/searchQueryLeaves';

const RECORDING_RULE_FIELDS = [
  'title',
  'folder',
  'paused',
  'labels',
  'datasourceUIDs',
  'interval',
  'metric',
  'targetDatasourceUID',
  // Recording rules have no "state", only health (see recordingRule.cue searchFields).
  'health',
  'lastEvaluationTime',
  'evaluationDuration',
  'lastError',
];

function buildRecordingOnlyLeaves(filter: RuleSearchFilter): SearchQueryLeaf[] {
  const leaves: SearchQueryLeaf[] = [];

  if (filter.metric) {
    leaves.push({ filter: { field: 'metric', operator: 'In', values: [filter.metric] } });
  }
  if (filter.targetDataSourceUid) {
    leaves.push({ filter: { field: 'targetDatasourceUID', operator: 'In', values: [filter.targetDataSourceUid] } });
  }

  return leaves;
}

export function buildRecordingRuleSearchQuery(filter: RuleSearchFilter, options: BuildSearchQueryOptions = {}) {
  const leaves = [
    ...buildSharedLeaves(filter),
    ...buildRecordingOnlyLeaves(filter),
    ...buildHealthLeaves(filter, 'Recording'),
  ];

  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where: toWhere(leaves),
    sort: [{ field: 'title', direction: 'asc' }],
    fields: RECORDING_RULE_FIELDS,
    limit: options.limit ?? DEFAULT_PER_PAGE_PAGINATION,
    ...(options.continue ? { continue: options.continue } : {}),
  } satisfies ListRecordingRuleSearchRulesV0Alpha1RequestBody;
}
