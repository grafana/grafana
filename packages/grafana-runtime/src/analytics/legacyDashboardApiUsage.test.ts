import { __resetLegacyDashboardApiUsageDedupeForTests, reportLegacyDashboardApiUsage } from './legacyDashboardApiUsage';
import { reportInteraction } from './utils';

jest.mock('./utils', () => ({ reportInteraction: jest.fn() }));
const reportInteractionMock = reportInteraction as jest.Mock;

describe('reportLegacyDashboardApiUsage', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    reportInteractionMock.mockClear();
    __resetLegacyDashboardApiUsageDedupeForTests();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('emits grafana_legacy_dashboard_api_used interaction', () => {
    reportLegacyDashboardApiUsage({ pluginId: 'p', apiName: 'PanelMigrationHandler.invoke' });
    expect(reportInteractionMock).toHaveBeenCalledTimes(1);
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_legacy_dashboard_api_used',
      expect.objectContaining({ pluginId: 'p', apiName: 'PanelMigrationHandler.invoke' })
    );
  });

  it('forwards extra properties', () => {
    reportLegacyDashboardApiUsage({
      pluginId: 'p',
      apiName: 'PanelMigrationHandler.invoke',
      extra: { fromVersion: '1', toVersion: '2' },
    });
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_legacy_dashboard_api_used',
      expect.objectContaining({ fromVersion: '1', toVersion: '2' })
    );
  });

  it('dedupes by (pluginId, apiName) within a session', () => {
    for (let i = 0; i < 3; i++) {
      reportLegacyDashboardApiUsage({ pluginId: 'p', apiName: 'PanelMigrationHandler.invoke' });
    }
    expect(reportInteractionMock).toHaveBeenCalledTimes(1);
  });

  it('reports separately per apiName for the same pluginId', () => {
    reportLegacyDashboardApiUsage({ pluginId: 'p', apiName: 'PanelMigrationHandler.invoke' });
    reportLegacyDashboardApiUsage({ pluginId: 'p', apiName: 'RefreshEvent.subscribe' });
    expect(reportInteractionMock).toHaveBeenCalledTimes(2);
  });

  it('reports separately per pluginId for the same apiName', () => {
    reportLegacyDashboardApiUsage({ pluginId: 'a', apiName: 'PanelMigrationHandler.invoke' });
    reportLegacyDashboardApiUsage({ pluginId: 'b', apiName: 'PanelMigrationHandler.invoke' });
    expect(reportInteractionMock).toHaveBeenCalledTimes(2);
  });

  it('console.warns once per (pluginId, apiName)', () => {
    reportLegacyDashboardApiUsage({ pluginId: 'p', apiName: 'PanelMigrationHandler.invoke' });
    reportLegacyDashboardApiUsage({ pluginId: 'p', apiName: 'PanelMigrationHandler.invoke' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
