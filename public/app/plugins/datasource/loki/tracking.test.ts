import { CoreApp, DashboardLoadedEvent, DataQueryRequest, dateTime } from '@grafana/data';
import { QueryEditorMode } from '@grafana/plugin-ui';
import { reportInteraction } from '@grafana/runtime';

import pluginJson from './plugin.json';
import { partitionTimeRange } from './querySplitting';
import { onDashboardLoadedHandler, trackGroupedQueries, trackQuery } from './tracking';
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
const originalRequest = {
  targets: [
    { expr: 'count_over_time({a="b"}[1m])', refId: 'A', ...baseTarget },
    { expr: '{a="b"}', refId: 'B', maxLines: 10, ...baseTarget },
    { expr: 'count_over_time({hidden="true"}[1m])', refId: 'C', ...baseTarget, hide: true },
  ],
  range,
  app: CoreApp.Explore,
} as DataQueryRequest<LokiQuery>;

const requests: LokiGroupedRequest[] = [
  {
    request: {
      targets: [{ expr: 'count_over_time({a="b"}[1m])', refId: 'A', ...baseTarget }],
      range,
      app: 'explore',
    } as DataQueryRequest<LokiQuery>,
    partition: partitionTimeRange(true, range, 60000, 24 * 60 * 60 * 1000),
  },
  {
    request: {
      targets: [{ expr: '{a="b"}', refId: 'B', maxLines: 10, ...baseTarget }],
      range,
      app: 'explore',
    } as DataQueryRequest<LokiQuery>,
    partition: partitionTimeRange(false, range, 60000, 24 * 60 * 60 * 1000),
  },
];

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('Wed May 17 2023 17:20:12 GMT+0200'));
});
afterAll(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});
beforeEach(() => {
  jest.mocked(reportInteraction).mockClear();
});

describe('Tracks queries', () => {
  it('should track queries in Explore', () => {
    trackQuery({ data: [] }, originalRequest, new Date());
    expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_loki_query_executed', {
      bytes_processed: 0,
      editor_mode: 'builder',
      grafana_version: '1.0',
      has_data: false,
      has_error: false,
      is_split: false,
      legend: undefined,
      line_limit: undefined,
      obfuscated_query: 'count_over_time({Identifier=String}[1m])',
      query_type: 'metric',
      query_vector_type: undefined,
      resolution: 1,
      simultaneously_executed_query_count: 2,
      simultaneously_hidden_query_count: 1,
      time_range_from: '2023-02-08T05:00:00.000Z',
      time_range_to: '2023-02-10T06:00:00.000Z',
      time_taken: 0,
    });
  });

  it('should not track queries if app is not Explore', () => {
    trackQuery({ data: [] }, { ...originalRequest, app: CoreApp.PanelViewer }, new Date());
    expect(reportInteraction).not.toHaveBeenCalled();
  });

  it('should not track queries if no app', () => {
    trackQuery({ data: [] }, { ...originalRequest, app: '' }, new Date());
    expect(reportInteraction).not.toHaveBeenCalled();
  });
});

test('Tracks grouped queries', () => {
  trackGroupedQueries({ data: [] }, requests, originalRequest, new Date());

  expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_loki_query_executed', {
    bytes_processed: 0,
    editor_mode: 'builder',
    grafana_version: '1.0',
    has_data: false,
    has_error: false,
    is_split: true,
    legend: undefined,
    line_limit: undefined,
    obfuscated_query: 'count_over_time({Identifier=String}[1m])',
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
  });

  expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_loki_query_executed', {
    bytes_processed: 0,
    editor_mode: 'builder',
    grafana_version: '1.0',
    has_data: false,
    has_error: false,
    is_split: true,
    legend: undefined,
    line_limit: 10,
    obfuscated_query: '{Identifier=String}',
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
  });
});

describe('onDashboardLoadedHandler', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
    jest.spyOn(console, 'error');
  });
  test('Reports dashboard loaded interactions', () => {
    const event = new DashboardLoadedEvent({
      dashboardId: 'test',
      orgId: 1,
      userId: 2,
      grafanaVersion: '11',
      queries: {
        [pluginJson.id]: originalRequest.targets,
      },
    });
    onDashboardLoadedHandler(event);

    expect(reportInteraction).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('Does not report or fails when the dashboard id has no queries', () => {
    const event = new DashboardLoadedEvent({
      dashboardId: 'test',
      orgId: 1,
      userId: 2,
      grafanaVersion: '11',
      queries: {
        'not loki': originalRequest.targets,
      },
    });
    onDashboardLoadedHandler(event);

    expect(reportInteraction).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
