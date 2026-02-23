import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopesService } from '../ScopesService';

import { enterEditMode, openSelector, toggleDashboards } from './utils/actions';
import {
  expectDashboardsClosed,
  expectDashboardsDisabled,
  expectScopesSelectorClosed,
  expectScopesSelectorDisabled,
} from './utils/assertions';
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

  it('Enters view mode', async () => {
    await enterEditMode(dashboardScene);
    expect(scopesService.state.readOnly).toEqual(true);
    expect(scopesService.state.drawerOpened).toEqual(false);
  });

  it('Closes selector on enter', async () => {
    await openSelector();
    await enterEditMode(dashboardScene);
    expectScopesSelectorClosed();
  });

  it('Closes dashboards list on enter', async () => {
    await toggleDashboards();
    await enterEditMode(dashboardScene);
    expectDashboardsClosed();
  });

  it('Does not show selector when view mode is active', async () => {
    await enterEditMode(dashboardScene);
    expectScopesSelectorDisabled();
  });

  it('Does not show the expand button when view mode is active', async () => {
    await enterEditMode(dashboardScene);
    expectDashboardsDisabled();
  });
});
