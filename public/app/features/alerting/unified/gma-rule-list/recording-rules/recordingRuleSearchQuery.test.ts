import { getRuleSearchQueryViolations } from '../mocks/ruleSearchQueryContract';
import { type HealthValue, type RuleSearchFilter, createEmptyFilter } from '../rule-search/ruleSearchFilter';

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
  it('an empty filter has no where clause and the recording-rule field set', () => {
    expect(buildRecordingRuleSearchQuery(createEmptyFilter())).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: undefined,
      sort: [{ field: 'title', direction: 'asc' }],
      fields: recordingFields,
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildRecordingRuleSearchQuery(createEmptyFilter(), 'opaque-token').continue).toBe('opaque-token');
  });

  it('metric filters by exact match', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), metric: 'cpu_usage' };
    expect(buildRecordingRuleSearchQuery(filter).where).toEqual({
      filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] },
    });
  });

  it('target data source filters by targetDatasourceUID', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), targetDataSourceUid: 'target-ds-1' };
    expect(buildRecordingRuleSearchQuery(filter).where).toEqual({
      filter: { field: 'targetDatasourceUID', operator: 'In', values: ['target-ds-1'] },
    });
  });

  it('metric and target data source combine under one and', () => {
    const filter: RuleSearchFilter = {
      ...createEmptyFilter(),
      metric: 'cpu_usage',
      targetDataSourceUid: 'target-ds-1',
    };
    expect(buildRecordingRuleSearchQuery(filter).where).toEqual({
      and: [
        { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
        { filter: { field: 'targetDatasourceUID', operator: 'In', values: ['target-ds-1'] } },
      ],
    });
  });

  it.each<[HealthValue, string]>([
    ['ok', 'Recording'],
    ['nodata', 'NoData'],
    ['error', 'Error'],
    ['err', 'Error'],
    ['unknown', 'Unknown'],
  ])('health:%s sends health In [%s]', (health, value) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), health };
    expect(buildRecordingRuleSearchQuery(filter).where).toEqual({
      filter: { field: 'health', operator: 'In', values: [value] },
    });
  });

  it('plugins:hide sends the negated plugin-origin regex', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), hidePluginRules: true };
    expect(buildRecordingRuleSearchQuery(filter).where).toEqual({
      regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true },
    });
  });

  it.each<[string, RuleSearchFilter]>([
    ['empty filter', createEmptyFilter()],
    ['free text and a folder', { ...createEmptyFilter(), text: ['cpu'], namespaces: ['f1'] }],
    [
      'labels and hidden plugin rules',
      { ...createEmptyFilter(), hidePluginRules: true, labels: [{ key: 'a', operator: 'notEqual', value: 'x' }] },
    ],
    [
      'metric and target data source',
      { ...createEmptyFilter(), metric: 'cpu_usage', targetDataSourceUid: 'target-ds-1' },
    ],
    ['health', { ...createEmptyFilter(), health: 'ok' }],
  ])('%s: builds a request the per-kind rule search accepts', (_name, filter) => {
    expect(getRuleSearchQueryViolations(buildRecordingRuleSearchQuery(filter), 'recording')).toEqual([]);
  });
});
