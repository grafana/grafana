import { act, cleanup } from '@testing-library/react';

import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { type ScopesService } from '../ScopesService';
import { type ScopesSelectorService } from '../selector/ScopesSelectorService';

import { enterEditMode, openSelector, toggleDashboards } from './utils/actions';
import { expectDashboardsOpen } from './utils/assertions';
import { getDatasource, getInstanceSettings } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';
import { getDashboardsExpand, getSelectorInput, querySelectorApply } from './utils/selectors';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

setBackendSrv(backendSrv);
setupMockServer();

describe('Scope selector in edit mode', () => {
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

  it('Does not set scopes to read only when entering edit mode', async () => {
    await enterEditMode(dashboardScene);
    expect(scopesService.state.readOnly).toEqual(false);
  });

  it('Does not close selector when entering edit mode', async () => {
    await openSelector();
    await enterEditMode(dashboardScene);
    expect(querySelectorApply()).toBeInTheDocument();
  });

  it('Does not close dashboards list when entering edit mode', async () => {
    await toggleDashboards();
    await enterEditMode(dashboardScene);
    expectDashboardsOpen();
  });

  it('Does not disable selector when edit mode is active', async () => {
    await enterEditMode(dashboardScene);
    expect(getSelectorInput()).not.toBeDisabled();
  });

  it('Does not disable the expand button when edit mode is active', async () => {
    await enterEditMode(dashboardScene);
    expect(getDashboardsExpand()).not.toBeDisabled();
  });
});

describe('setReadOnly', () => {
  let scopesService: ScopesService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(async () => {
    const renderResult = await renderDashboard();
    scopesService = renderResult.scopesService;
  });

  afterEach(async () => {
    await resetScenes();
  });

  it('Sets readOnly state and closes selector when called with true', async () => {
    await openSelector();
    expect(querySelectorApply()).toBeInTheDocument();

    act(() => {
      scopesService.setReadOnly(true);
    });

    expect(scopesService.state.readOnly).toEqual(true);
    expect(querySelectorApply()).not.toBeInTheDocument();
  });

  it('Sets readOnly state without closing selector when called with false', async () => {
    await openSelector();
    expect(querySelectorApply()).toBeInTheDocument();

    act(() => {
      scopesService.setReadOnly(false);
    });

    expect(scopesService.state.readOnly).toEqual(false);
    expect(querySelectorApply()).toBeInTheDocument();
  });
});

describe('setRedirectEnabled', () => {
  let dashboardScene: DashboardScene;
  let scopesSelectorService: ScopesSelectorService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(async () => {
    const renderResult = await renderDashboard();
    dashboardScene = renderResult.scene;
    scopesSelectorService = renderResult.scopesSelectorService;
  });

  afterEach(async () => {
    await resetScenes();
  });

  it('Disables redirects when entering edit mode', async () => {
    const spy = jest.spyOn(scopesSelectorService, 'setRedirectEnabled');

    await enterEditMode(dashboardScene);

    expect(spy).toHaveBeenCalledWith(false);
  });

  it('Re-enables redirects when exiting edit mode', async () => {
    const spy = jest.spyOn(scopesSelectorService, 'setRedirectEnabled');

    await enterEditMode(dashboardScene);
    act(() => {
      dashboardScene.exitEditMode({ skipConfirm: true });
    });

    expect(spy).toHaveBeenCalledWith(true);
  });

  it('Re-enables redirects when component unmounts while still in edit mode', async () => {
    await enterEditMode(dashboardScene);

    const spy = jest.spyOn(scopesSelectorService, 'setRedirectEnabled');

    act(() => {
      cleanup();
    });

    expect(spy).toHaveBeenCalledWith(true);
  });
});
