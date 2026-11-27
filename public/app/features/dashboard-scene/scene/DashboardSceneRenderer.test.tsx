import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, setPluginLinksHook } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv, RedirectToUrlKey } from 'app/core/services/context_srv';
import { getLoginSectionTitle } from 'app/core/services/loginSectionTitle';

import { endTemplateAdoption, getTemplateAdoption, startTemplateAdoption } from '../lifecycle/templateAdoption';

import { DashboardScene } from './DashboardScene';
import { DashboardSceneRenderer } from './DashboardSceneRenderer';

setPluginLinksHook(() => ({ links: [], isLoading: false }));

// The Assistant's adopter, which says it turns the template into a draft.
jest.mock('app/features/plugins/extensions/utils', () => ({
  ...jest.requireActual('app/features/plugins/extensions/utils'),
  getAppPluginConfigs: jest.fn(async () => []),
  getExtensionPointPluginDependencies: jest.fn(async () => ['grafana-assistant-app']),
}));
jest.mock('app/features/plugins/pluginPreloader', () => ({ preloadPlugins: jest.fn(async () => undefined) }));
jest.mock('app/features/plugins/extensions/registry/setup', () => ({
  ...jest.requireActual('app/features/plugins/extensions/registry/setup'),
  getPluginExtensionRegistries: jest.fn(async () => ({
    addedFunctionsRegistry: {
      getState: async () => ({ 'grafana/dashboard/template-adoption/v1': [{ fn: () => true }] }),
    },
  })),
}));

describe('DashboardSceneRenderer login title', () => {
  const originalSignedIn = contextSrv.user.isSignedIn;
  const originalSubUrl = config.appSubUrl;

  beforeEach(() => {
    contextSrv.user.isSignedIn = true;
    config.appSubUrl = '';
    sessionStorage.clear();
    setTestFlags({
      [FlagKeys.GrafanaPreserveLoginTabTitle]: true,
      [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: true,
    });
  });

  afterEach(() => {
    contextSrv.user.isSignedIn = originalSignedIn;
    config.appSubUrl = originalSubUrl;
    sessionStorage.clear();
    act(() => setTestFlags({}));
  });

  function setup() {
    const dashboard = new DashboardScene({ uid: 'abc', title: 'Mimir / Writes' });
    const node = { id: 'dashboards/browse', text: 'Dashboards' };
    render(<DashboardSceneRenderer model={dashboard} />, {
      historyOptions: { initialEntries: ['/d/abc/writes'] },
      preloadedState: { navIndex: { 'dashboards/browse': node } },
    });
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/d/abc/writes'));
    return dashboard;
  }

  it('remembers a renamed title without remounting the dashboard', () => {
    const dashboard = setup();
    expect(getLoginSectionTitle()).toBe('Mimir / Writes');

    act(() => dashboard.setState({ title: 'Mimir / Reads' }));

    expect(getLoginSectionTitle()).toBe('Mimir / Reads');
  });

  it('remembers the dashboard title when the original flag becomes enabled', async () => {
    setTestFlags({
      [FlagKeys.GrafanaPreserveLoginTabTitle]: false,
      [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: true,
    });
    setup();
    expect(sessionStorage.getItem('grafana.loginSection')).toBeNull();

    await act(async () =>
      setTestFlags({
        [FlagKeys.GrafanaPreserveLoginTabTitle]: true,
        [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: true,
      })
    );

    expect(getLoginSectionTitle()).toBe('Mimir / Writes');
  });
});

describe('DashboardSceneRenderer while the Assistant adopts a template', () => {
  beforeEach(() => {
    setTestFlags({ [FlagKeys.AssistantDashboardArtifacts]: true });
  });

  afterEach(() => {
    act(() => endTemplateAdoption());
    act(() => setTestFlags({}));
  });

  function renderDashboard(dashboard: DashboardScene, path: string) {
    const node = { id: 'dashboards/browse', text: 'Dashboards' };
    return render(<DashboardSceneRenderer model={dashboard} />, {
      historyOptions: { initialEntries: [path] },
      preloadedState: { navIndex: { 'dashboards/browse': node } },
    });
  }

  it('covers the template with the building screen, keeping the template mounted under it', async () => {
    act(() => {
      startTemplateAdoption();
    });
    const template = new DashboardScene({ title: 'DORA metrics' });

    renderDashboard(template, '/dashboard/template?gnetId=24372');
    await act(async () => {});

    expect(screen.getByTestId('dashboard-template-adoption-cover')).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.DashboardSidebarSplitter.primaryBody)).toBeInTheDocument();
  });

  it('shows the draft the template became, and ends the building screen', async () => {
    act(() => {
      startTemplateAdoption();
    });
    const draft = new DashboardScene({ title: 'DORA metrics', meta: { newDashboardUid: 'new-uid' } });

    renderDashboard(draft, '/d/new-uid?pendingChanges=chat-1');
    await act(async () => {});

    expect(screen.queryByTestId('dashboard-template-adoption-cover')).not.toBeInTheDocument();
    expect(getTemplateAdoption()).toBeUndefined();
  });
});
