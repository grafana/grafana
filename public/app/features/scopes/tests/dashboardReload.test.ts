import { config } from '@grafana/runtime';

import { updateScopes } from './utils/actions';
import { expectDashboardReload, expectNotDashboardReload } from './utils/assertions';
import { getDatasource, getInstanceSettings, getMock } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

describe('Dashboard reload', () => {
  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  afterEach(async () => {
    await resetScenes();
  });

  it('Does not reload the dashboard without UID', async () => {
    renderDashboard({ uid: undefined }, { reloadOnScopesChange: true });
    await updateScopes(['grafana']);
    expectNotDashboardReload();
  });

  it('Reloads the dashboard with UID', async () => {
    renderDashboard({}, { reloadOnScopesChange: true });
    await updateScopes(['grafana']);
    expectDashboardReload();
  });
});
