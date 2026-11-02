import { type ListRecordingRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { parse } from '../rule-search/parser';
import { createEmptyFilter } from '../rule-search/sharedRuleFilter';

import { recordingRuleSearchSchema } from './recordingRuleFilters';
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

describe('buildRecordingRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows, without a state field', () => {
    expect(buildRecordingRuleSearchQuery(createEmptyFilter())).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: undefined,
      sort: [{ field: 'title', direction: 'asc' }],
      fields: [
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
      ],
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildRecordingRuleSearchQuery(createEmptyFilter(), 'opaque-token').continue).toBe('opaque-token');
  });

  it.each<[query: string, where: ListRecordingRuleSearchRulesV0Alpha1RequestBody['where']]>([
    ['metric:cpu_usage', { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } }],
    ['targetDatasource:prom-1', { filter: { field: 'targetDatasourceUID', operator: 'In', values: ['prom-1'] } }],
    ['health:ok', { filter: { field: 'health', operator: 'In', values: ['Recording'] } }],
    ['folder:f1 folder:f2', { filter: { field: 'folder', operator: 'In', values: ['f1', 'f2'] } }],
  ])('builds the where clause for %j', (query, where) => {
    expect(buildRecordingRuleSearchQuery(parse(query, recordingRuleSearchSchema).filter).where).toEqual(where);
  });

  it('combines several filters in one flat and', () => {
    expect(
      buildRecordingRuleSearchQuery(
        parse('cpu health:error targetDatasource:prom-1 metric:cpu_usage', recordingRuleSearchSchema).filter
      ).where
    ).toEqual({
      and: [
        { text: { value: 'cpu' } },
        { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
        { filter: { field: 'targetDatasourceUID', operator: 'In', values: ['prom-1'] } },
        { filter: { field: 'health', operator: 'In', values: ['Error'] } },
      ],
    });
  });
});
