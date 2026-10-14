import { type Criteria } from '../rule-search/criteria';
import {
  type BuildSearchQueryOptions,
  DEFAULT_LIMIT,
  type SearchQuery,
  type SearchQueryLeaf,
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
  // status fields — see apps/alerting/rules/kinds/recordingRule.cue searchFields (recording
  // rules have no "state": they have no firing/pending notion, only health)
  'health',
  'lastEvaluationTime',
  'evaluationDuration',
  'lastError',
];

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
