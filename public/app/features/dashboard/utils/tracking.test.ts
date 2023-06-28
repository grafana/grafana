import { getDashboardModel } from 'test/helpers/getDashboardModel';

import * as runtime from '@grafana/runtime';

import { trackDashboardLoaded } from './tracking';

describe('trackDashboardLoaded', () => {
  it('should report dashboard_loaded interaction with correct parameters', () => {
    const dashboardJSON = {
      uid: 'dashboard-123',
      title: 'Test Dashboard',
      panels: [
        { id: 1, type: 'row', repeat: 'dc', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
        { id: 2, repeat: 'app', repeatDirection: 'h', gridPos: { x: 0, y: 1, h: 2, w: 8 } },
      ],
      templating: {
        list: [
          { type: 'query', name: 'Query 1' },
          { type: 'interval', name: 'Interval 1' },
          { type: 'query', name: 'Query 2' },
        ],
      },
    };
    const model = getDashboardModel(dashboardJSON);
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction');

    trackDashboardLoaded(model, 16);

    expect(reportInteractionSpy).toHaveBeenCalledWith('dashboards_init_dashboard_completed', {
      uid: 'dashboard-123',
      title: 'Test Dashboard',
      theme: 'dark',
      schemaVersion: model.schemaVersion, // This value is based on public/app/features/dashboard/state/DashboardMigrator.ts#L81
      panels_count: 2,
      variable_type_query_count: 2,
      variable_type_interval_count: 1,
      version_before_migration: 16,
    });
  });
});
