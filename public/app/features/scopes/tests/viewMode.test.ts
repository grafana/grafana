import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopesService } from '../ScopesService';

import { enterEditMode } from './utils/actions';
import { getDatasource, getInstanceSettings } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

setBackendSrv(backendSrv);
setupMockServer();

describe('View mode', () => {
  let dashboardScene: DashboardScene;
  let scopesService: ScopesService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(async () => {
    const renderResult = await renderDashboard();
    dashboardScene = renderResult.scene;
    scopesService = renderResult.scopesService;
  });

  afterEach(async () => {
    await resetScenes();
  });

  it('Allows scopes in edit mode', async () => {
    await enterEditMode(dashboardScene);
    // Scopes should now be editable even when in edit mode
    expect(scopesService.state.readOnly).toEqual(false);
  });
});
