import { DashboardLoadedEvent } from '@grafana/data';
let handler: (e: DashboardLoadedEvent<CloudWatchQuery>) => {};
import { reportInteraction } from '@grafana/runtime';

import './module';
import { CloudWatchDashboardLoadedEvent } from './__mocks__/dashboardOnLoadedEvent';
import { CloudWatchQuery } from './types';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    getAppEvents: () => ({
      subscribe: jest.fn((e, h) => {
        handler = h;
      }),
    }),
  };
});

describe('onDashboardLoadedHandler', () => {
  it('should report a `grafana_ds_cloudwatch_dashboard_loaded` interaction ', () => {
    handler(CloudWatchDashboardLoadedEvent);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_ds_cloudwatch_dashboard_loaded', {
      dashboard_id: 'dashboard123',
      grafana_version: 'v9.0.0',
      org_id: 1,
      logs_queries_count: 1,
      metrics_queries_count: 20,
      metrics_query_builder_count: 3,
      metrics_query_code_count: 4,
      metrics_query_count: 7,
      metrics_search_builder_count: 8,
      metrics_search_code_count: 5,
      metrics_search_count: 13,
      metrics_search_match_exact_count: 8,
    });
  });
});
