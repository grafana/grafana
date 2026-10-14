import { type Criteria, createEmptyCriteria } from '../rule-search/criteria';
import { getRuleSearchQueryViolations } from '../rule-search/ruleSearchQueryContract';

import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

const recordingFields = [
  'title',
  'folder',
  'paused',
  'labels',
  'datasourceUIDs',
  'interval',
  'metric',
  'targetDatasourceUID',
  'health',
  'lastEvaluationTime',
  'evaluationDuration',
  'lastError',
];

describe('buildRecordingRuleSearchQuery', () => {
  it('SEARCH-4.1: an empty criteria has no where clause and the recording-rule field set', () => {
    expect(buildRecordingRuleSearchQuery(createEmptyCriteria())).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: undefined,
      sort: [{ field: 'title', direction: 'asc' }],
      fields: recordingFields,
      limit: 40,
    });
  });

  it('SEARCH-4.2: metric filters by exact match', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), metric: 'cpu_usage' };
    expect(buildRecordingRuleSearchQuery(criteria).where).toEqual({
      filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] },
    });
  });

  it('SEARCH-4.3: target data source filters by targetDatasourceUID', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), targetDataSourceUid: 'target-ds-1' };
    expect(buildRecordingRuleSearchQuery(criteria).where).toEqual({
      filter: { field: 'targetDatasourceUID', operator: 'In', values: ['target-ds-1'] },
    });
  });

  it('SEARCH-4.4: metric and target data source combine under one and', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), metric: 'cpu_usage', targetDataSourceUid: 'target-ds-1' };
    expect(buildRecordingRuleSearchQuery(criteria).where).toEqual({
      and: [
        { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
        { filter: { field: 'targetDatasourceUID', operator: 'In', values: ['target-ds-1'] } },
      ],
    });
  });

  it.each<[string, Criteria]>([
    ['empty criteria', createEmptyCriteria()],
    ['free text and a folder', { ...createEmptyCriteria(), text: ['cpu'], namespaces: ['f1'] }],
    [
      'labels and hidden plugin rules',
      { ...createEmptyCriteria(), hidePluginRules: true, labels: [{ key: 'a', operator: 'notEqual', value: 'x' }] },
    ],
    [
      'metric and target data source',
      { ...createEmptyCriteria(), metric: 'cpu_usage', targetDataSourceUid: 'target-ds-1' },
    ],
    ['health', { ...createEmptyCriteria(), health: 'error' }],
  ])('SEARCH-4.5 (%s): builds a request the per-kind rule search accepts', (_name, criteria) => {
    expect(getRuleSearchQueryViolations(buildRecordingRuleSearchQuery(criteria), 'recording')).toEqual([]);
  });
});
