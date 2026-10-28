import { type ListRecordingRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type RuleSearchFilter } from '../rule-search/ruleSearchFilter';
import { type SourcedLeaf, buildHealthLeaves, buildSharedLeaves, toWhere } from '../rule-search/searchQueryLeaves';

export function buildRecordingRuleSearchQuery(filter: RuleSearchFilter, continueToken?: string) {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where: toWhere(buildRecordingRuleLeaves(filter)),
    sort: [{ field: 'title', direction: 'asc' }],
    fields: RECORDING_RULE_FIELDS,
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  } satisfies ListRecordingRuleSearchRulesV0Alpha1RequestBody;
}

/** The request's leaves in order, each with the filter it came from. */
export function buildRecordingRuleLeaves(filter: RuleSearchFilter): SourcedLeaf[] {
  return [...buildSharedLeaves(filter), ...buildRecordingLeaves(filter), ...buildHealthLeaves(filter, 'Recording')];
}

function buildRecordingLeaves(filter: RuleSearchFilter): SourcedLeaf[] {
  const leaves: SourcedLeaf[] = [];

  if (filter.metric) {
    leaves.push({ key: 'metric', leaf: { filter: { field: 'metric', operator: 'In', values: [filter.metric] } } });
  }
  if (filter.targetDataSourceUid) {
    leaves.push({
      key: 'targetDatasource',
      leaf: { filter: { field: 'targetDatasourceUID', operator: 'In', values: [filter.targetDataSourceUid] } },
    });
  }

  return leaves;
}

// `health` and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// Recording rules have no annotations field; `interval` is the evaluation cadence.
// `labels` and `datasourceUIDs` are arrays; `metric` and `targetDatasourceUID` are direct strings.
const RECORDING_RULE_FIELDS = [
  'title',
  'folder',
  'paused',
  'health',
  'lastError',
  'interval',
  'labels',
  'datasourceUIDs',
  'metric',
  'targetDatasourceUID',
];
