import { getQueryOptions } from 'test/helpers/getQueryOptions';

import { dateTime } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { QueryEditorMode } from '../prometheus/querybuilder/shared/types';

import { partitionTimeRange } from './querySplitting';
import { trackGroupedQueries, trackQuery } from './tracking';
import { LokiGroupedRequest, LokiQuery } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const baseTarget = {
  resolution: 1,
  editorMode: QueryEditorMode.Builder,
};
const range = {
  from: dateTime('2023-02-08T05:00:00.000Z'),
  to: dateTime('2023-02-10T06:00:00.000Z'),
  raw: {
    from: dateTime('2023-02-08T05:00:00.000Z'),
    to: dateTime('2023-02-10T06:00:00.000Z'),
  },
};
const originalRequest = getQueryOptions<LokiQuery>({
  targets: [
    { expr: 'count_over_time({a="b"}[1m])', refId: 'A', ...baseTarget },
    { expr: '{a="b"}', refId: 'B', maxLines: 10, ...baseTarget },
    { expr: 'count_over_time({hidden="true"}[1m])', refId: 'C', ...baseTarget, hide: true },
  ],
  range,
  app: 'explore',
});
const requests: LokiGroupedRequest[] = [
  {
    request: {
      ...getQueryOptions<LokiQuery>({
        targets: [{ expr: 'count_over_time({a="b"}[1m])', refId: 'A', ...baseTarget }],
        range,
      }),
      app: 'explore',
    },
    partition: partitionTimeRange(true, range, 60000, 24 * 60 * 60 * 1000),
  },
  {
    request: {
      ...getQueryOptions<LokiQuery>({
        targets: [{ expr: '{a="b"}', refId: 'B', maxLines: 10, ...baseTarget }],
        range,
      }),
      app: 'explore',
    },
    partition: partitionTimeRange(false, range, 60000, 24 * 60 * 60 * 1000),
  },
];

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('Wed May 17 2023 17:20:12 GMT+0200'));
});
afterAll(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  jest.mocked(reportInteraction).mockClear();
});

test('Tracks queries', () => {
  trackQuery({ data: [] }, originalRequest, new Date());

  expect(reportInteraction).toHaveBeenCalledWith('grafana_loki_query_executed', {
    app: 'explore',
    bytes_processed: 0,
    editor_mode: 'builder',
    grafana_version: '1.0',
    has_data: false,
    has_error: false,
    is_split: false,
    legend: undefined,
    line_limit: undefined,
    obfuscated_query: 'count_over_time({Identifier=String}[1m])',
    parsed_query:
      'LogQL,Expr,MetricExpr,RangeAggregationExpr,RangeOp,CountOverTime,LogRangeExpr,Selector,Matchers,Matcher,Identifier,Eq,String,Range,Duration',
    query_type: 'metric',
    query_vector_type: undefined,
    resolution: 1,
    simultaneously_executed_query_count: 2,
    simultaneously_hidden_query_count: 1,
    time_range_from: '2023-02-08T05:00:00.000Z',
    time_range_to: '2023-02-10T06:00:00.000Z',
    time_taken: 0,
    predefined_operations_applied: 'n/a',
  });
});

test('Tracks predefined operations', () => {
  trackQuery({ data: [] }, originalRequest, new Date(), { predefinedOperations: 'count_over_time' });

  expect(reportInteraction).toHaveBeenCalledWith('grafana_loki_query_executed', {
    app: 'explore',
    bytes_processed: 0,
    editor_mode: 'builder',
    grafana_version: '1.0',
    has_data: false,
    has_error: false,
    is_split: false,
    legend: undefined,
    line_limit: undefined,
    obfuscated_query: 'count_over_time({Identifier=String}[1m])',
    parsed_query:
      'LogQL,Expr,MetricExpr,RangeAggregationExpr,RangeOp,CountOverTime,LogRangeExpr,Selector,Matchers,Matcher,Identifier,Eq,String,Range,Duration',
    query_type: 'metric',
    query_vector_type: undefined,
    resolution: 1,
    simultaneously_executed_query_count: 2,
    simultaneously_hidden_query_count: 1,
    time_range_from: '2023-02-08T05:00:00.000Z',
    time_range_to: '2023-02-10T06:00:00.000Z',
    time_taken: 0,
    predefined_operations_applied: true,
  });
});

test('Tracks grouped queries', () => {
  trackGroupedQueries({ data: [] }, requests, originalRequest, new Date());

  expect(reportInteraction).toHaveBeenCalledWith('grafana_loki_query_executed', {
    app: 'explore',
    bytes_processed: 0,
    editor_mode: 'builder',
    grafana_version: '1.0',
    has_data: false,
    has_error: false,
    is_split: true,
    legend: undefined,
    line_limit: undefined,
    obfuscated_query: 'count_over_time({Identifier=String}[1m])',
    parsed_query:
      'LogQL,Expr,MetricExpr,RangeAggregationExpr,RangeOp,CountOverTime,LogRangeExpr,Selector,Matchers,Matcher,Identifier,Eq,String,Range,Duration',
    query_type: 'metric',
    query_vector_type: undefined,
    resolution: 1,
    simultaneously_executed_query_count: 2,
    simultaneously_hidden_query_count: 1,
    split_query_group_count: 2,
    split_query_largest_partition_size: 3,
    split_query_partition_size: 3,
    split_query_total_request_count: 6,
    time_range_from: '2023-02-08T05:00:00.000Z',
    time_range_to: '2023-02-10T06:00:00.000Z',
    time_taken: 0,
    predefined_operations_applied: 'n/a',
  });

  expect(reportInteraction).toHaveBeenCalledWith('grafana_loki_query_executed', {
    app: 'explore',
    bytes_processed: 0,
    editor_mode: 'builder',
    grafana_version: '1.0',
    has_data: false,
    has_error: false,
    is_split: true,
    legend: undefined,
    line_limit: 10,
    obfuscated_query: '{Identifier=String}',
    parsed_query: 'LogQL,Expr,LogExpr,Selector,Matchers,Matcher,Identifier,Eq,String',
    query_type: 'logs',
    query_vector_type: undefined,
    resolution: 1,
    simultaneously_executed_query_count: 2,
    simultaneously_hidden_query_count: 1,
    split_query_group_count: 2,
    split_query_largest_partition_size: 3,
    split_query_partition_size: 3,
    split_query_total_request_count: 6,
    time_range_from: '2023-02-08T05:00:00.000Z',
    time_range_to: '2023-02-10T06:00:00.000Z',
    time_taken: 0,
    predefined_operations_applied: 'n/a',
  });
});
