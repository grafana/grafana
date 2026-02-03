import { CoreApp, DataQueryRequest, DataQueryResponse, DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { ElasticsearchDataQuery } from './dataquery.gen';
import pluginJson from './plugin.json';
import { onDashboardLoadedHandler, trackQuery } from './tracking';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const targets: ElasticsearchDataQuery[] = [
  {
    refId: 'test',
    alias: '$varAlias',
    bucketAggs: [],
    metrics: [],
    query: 'test',
  },
];

afterAll(() => {
  jest.clearAllMocks();
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
        [pluginJson.id]: targets,
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
        'not elasticsearch': targets,
      },
    });
    onDashboardLoadedHandler(event);

    expect(reportInteraction).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('trackQuery', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
  });

  test('tracks editor_type for code editor queries', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      editorType: 'code',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [],
    };

    const request: DataQueryRequest<ElasticsearchDataQuery> & { targets: ElasticsearchDataQuery[] } = {
      app: CoreApp.Explore,
      targets: [query],
    } as DataQueryRequest<ElasticsearchDataQuery>;

    const response: DataQueryResponse = {
      data: [{ length: 1 }],
    };

    trackQuery(response, request, new Date());

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_elasticsearch_query_executed',
      expect.objectContaining({
        editor_type: 'code',
      })
    );
  });

  test('tracks editor_type as builder for builder queries', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      editorType: 'builder',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [],
    };

    const request: DataQueryRequest<ElasticsearchDataQuery> & { targets: ElasticsearchDataQuery[] } = {
      app: CoreApp.Explore,
      targets: [query],
    } as DataQueryRequest<ElasticsearchDataQuery>;

    const response: DataQueryResponse = {
      data: [{ length: 1 }],
    };

    trackQuery(response, request, new Date());

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_elasticsearch_query_executed',
      expect.objectContaining({
        editor_type: 'builder',
      })
    );
  });

  test('defaults to builder when editor_type is not specified', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: 'test query',
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [],
    };

    const request: DataQueryRequest<ElasticsearchDataQuery> & { targets: ElasticsearchDataQuery[] } = {
      app: CoreApp.Explore,
      targets: [query],
    } as DataQueryRequest<ElasticsearchDataQuery>;

    const response: DataQueryResponse = {
      data: [{ length: 1 }],
    };

    trackQuery(response, request, new Date());

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_elasticsearch_query_executed',
      expect.objectContaining({
        editor_type: 'builder',
      })
    );
  });
});
