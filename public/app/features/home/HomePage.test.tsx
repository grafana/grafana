import { http, HttpResponse } from 'msw';
import { type ComponentType, lazy, useEffect } from 'react';
import { act, render, screen, waitFor } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, OrgRole, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { pluginMeta } from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { useNewsFeed } from 'app/plugins/panel/news/useNewsFeed';
import { AccessControlAction } from 'app/types/accessControl';

import { INCIDENTS_FILTER_STORAGE_KEY } from './AlertsIncidents/incidentFilter';
import { ACTIVE_INCIDENTS_QUERY, mockIncidents } from './AlertsIncidents/mockIncidentsApi';
import { ALERTS_TEAM_FILTER_STORAGE_KEY } from './AlertsIncidents/teamFilter';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import HomePage from './HomePage';
import { homepageViewed } from './analytics/main';
import { stubDatasource, stubSolution } from './solutions/test-utils';
import { useHomepageSolutions } from './useHomepageSolutions';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  usePluginBridge: jest.fn(),
}));

jest.mock('./analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
}));

jest.mock('app/plugins/panel/news/useNewsFeed');

jest.mock('./useHomepageSolutions', () => ({
  ...jest.requireActual('./useHomepageSolutions'),
  useHomepageSolutions: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const useNewsFeedMock = jest.mocked(useNewsFeed);

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  jest
    .mocked(useHomepageSolutions)
    .mockImplementation(jest.requireActual('./useHomepageSolutions').useHomepageSolutions);
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  mockUsePluginBridge.mockReturnValue({ installed: false, loading: false });
  useNewsFeedMock.mockReturnValue({
    state: { loading: false, error: undefined, value: undefined },
    getNews: jest.fn(),
  });

  // A signed-in org member is the default; the anonymous / no-org tests override this.
  jest.replaceProperty(contextSrv, 'isSignedIn', true);
  jest.replaceProperty(contextSrv.user, 'orgRole', OrgRole.Viewer);
  // Deny alerting permission so the FiringAlertsCard renders null
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
  // Stub endpoints the alerts/incidents cards probe so unhandled requests don't fail the test
  server.use(
    http.get('/api/user/teams', () => HttpResponse.json([])),
    http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json([])),
    // Report any probed app plugin as absent so plugin-gated cards render nothing
    http.get('/api/plugins/:pluginId/settings', () => HttpResponse.json({ enabled: false }))
  );
});

const createHomepageExtensionComponent = (
  pluginId: string,
  content: string,
  extensionPointId: PluginExtensionPoints
): ComponentTypeWithExtensionMeta<{}> =>
  createComponentWithMeta(
    {
      pluginId,
      title: content,
      component: () => <div>{content}</div>,
    },
    extensionPointId
  );

/** Active metrics solution served to the page; returns the fact mocks the tests observe. */
const stubMetricsSolution = () => {
  const datasource = jest.fn(async () => stubDatasource);
  const needsAttention = jest.fn(async () => false);
  const stub = stubSolution('metrics', {
    title: 'Metrics & infrastructure',
    signal: async () => 'active',
    datasource,
    needsAttention,
  });
  jest.mocked(useHomepageSolutions).mockReturnValue({ solutions: [stub], signals: jest.fn() });
  return { datasource, needsAttention };
};

describe('HomePage', () => {
  const originalBuildInfo = { ...config.buildInfo };
  const originalNamespace = config.namespace;

  afterEach(async () => {
    config.buildInfo = { ...originalBuildInfo };
    config.namespace = originalNamespace;
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted (RTL cleanup runs in a separate afterEach).
    await act(async () => {
      setTestFlags({});
    });
    jest.restoreAllMocks();
  });

  it('renders the greeting', async () => {
    render(<HomePage />);
    expect(await screen.findByRole('heading', { name: /^Good \w+\.$/ })).toBeInTheDocument();
  });

  it('scopes firing alerts to the team stored in local storage', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action === AccessControlAction.AlertingInstanceRead);
    window.localStorage.setItem(ALERTS_TEAM_FILTER_STORAGE_KEY, 'platform');
    const filters: string[][] = [];
    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        filters.push(new URL(request.url).searchParams.getAll('filter'));
        return HttpResponse.json([]);
      })
    );

    render(<HomePage />);

    await waitFor(() => expect(filters.length).toBeGreaterThan(0));
    expect(filters[0]).toEqual([expect.stringContaining('team=~')]);
    expect(filters[0][0]).toContain('platform');
  });

  it('scopes active incidents to their own stored filter, not the alerts team', async () => {
    mockUsePluginBridge.mockReturnValue({
      installed: true,
      loading: false,
      settings: { ...pluginMeta[SupportedPlugin.Irm], includes: [] },
    });
    window.localStorage.setItem(ALERTS_TEAM_FILTER_STORAGE_KEY, 'backend');
    window.localStorage.setItem(INCIDENTS_FILTER_STORAGE_KEY, 'squad:Frontend');
    const queries = mockIncidents([]);

    render(<HomePage />);

    await waitFor(() => expect(queries).toHaveLength(1));
    expect(queries[0]).toBe(`${ACTIVE_INCIDENTS_QUERY} field:squad:"Frontend"`);
  });

  it('renders the OSS welcome message', async () => {
    config.buildInfo.edition = GrafanaEdition.OpenSource;

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana.')).toBeInTheDocument();
  });

  it('renders dashboard tabs and auto-switches to starred', async () => {
    render(<HomePage />);

    // Default mocks have starred dashboards but no recent impressions, so DashboardTabs
    // auto-switches to the Starred tab once its fetches settle.
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
  });

  it('renders the Enterprise welcome message', async () => {
    config.buildInfo.edition = GrafanaEdition.Enterprise;

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana Enterprise.')).toBeInTheDocument();
  });

  it('renders the Cloud welcome message', async () => {
    config.namespace = 'stacks-12345';

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana Cloud.')).toBeInTheDocument();
  });

  it('renders homepage assistant extension components', async () => {
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.HomepageAssistant
          ? [
              createHomepageExtensionComponent(
                'grafana-assistant-app',
                'Homepage assistant extension',
                PluginExtensionPoints.HomepageAssistant
              ),
              createHomepageExtensionComponent(
                'grafana-untrusted-app',
                'Untrusted homepage assistant extension',
                PluginExtensionPoints.HomepageAssistant
              ),
            ]
          : [],
    }));

    render(<HomePage />);

    expect(await screen.findByText('Homepage assistant extension')).toBeInTheDocument();
    expect(screen.queryByText('Untrusted homepage assistant extension')).not.toBeInTheDocument();
  });

  it('renders homepage extra extension components', async () => {
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.HomepageExtra
          ? [
              createHomepageExtensionComponent(
                'grafana-setupguide-app',
                'Homepage extra extension 1',
                PluginExtensionPoints.HomepageExtra
              ),
              createHomepageExtensionComponent(
                'grafana-setupguide-app',
                'Homepage extra extension 2',
                PluginExtensionPoints.HomepageExtra
              ),
              createHomepageExtensionComponent(
                'grafana-untrusted-app',
                'Untrusted homepage extra extension',
                PluginExtensionPoints.HomepageExtra
              ),
            ]
          : [],
    }));

    render(<HomePage />);

    // Once revealed, both trusted extra extensions are shown and the untrusted one is filtered out.
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText('Homepage extra extension 1')).toBeInTheDocument();
    expect(screen.getByText('Homepage extra extension 2')).toBeInTheDocument();
    expect(screen.queryByText('Untrusted homepage extra extension')).not.toBeInTheDocument();
  });

  it('reserves the alerts card slot in the loading skeleton when the user can view firing alerts', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    setPluginComponentsHook(() => ({ components: [], isLoading: true }));

    render(<HomePage />);

    expect(await screen.findByTestId('home-page-skeleton-cards')).toBeInTheDocument();
  });

  it('renders a skeleton instead of the page content while extensions are loading', async () => {
    setPluginComponentsHook(() => ({ components: [], isLoading: true }));

    render(<HomePage />);

    expect(await screen.findByTestId('home-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();
  });

  it('renders a skeleton instead of the page content while the IRM plugin is loading', async () => {
    mockUsePluginBridge.mockReturnValue({ installed: undefined, loading: true });

    render(<HomePage />);

    expect(await screen.findByTestId('home-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();
  });

  it('lands on the auto-switched Starred tab once the dashboard fetches settle', async () => {
    render(<HomePage />);

    // dashboards load inside DashboardTabs now; the page does not gate reveal on them
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton')).not.toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).toHaveBeenCalledTimes(1);
  });

  it('reveals extension tabs together with the built-in tabs', async () => {
    const tabComponent = createComponentWithMeta(
      {
        pluginId: 'grafana-setupguide-app',
        title: 'Plugin tab',
        component: (({ register }: HomepageTabExtensionProps) => {
          useEffect(() => register({ id: 'plugin-tab', label: 'Plugin tab' }), [register]);
          return null;
        }) as React.ComponentType,
      },
      PluginExtensionPoints.HomepageTabs
    );

    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.HomepageTabs ? [tabComponent] : [],
    }));

    render(<HomePage />);

    // The extension tab registers from inside DashboardTabs and shows alongside the
    // built-in tabs once the tab list settles.
    expect(await screen.findByRole('tab', { name: 'Plugin tab' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
  });

  it('does not render HomepageTabs extension tabs on the redesigned homepage', async () => {
    setTestFlags({ 'grafana.growthHomepage': true });

    const tabComponent = createComponentWithMeta(
      {
        pluginId: 'grafana-setupguide-app',
        title: 'Plugin tab',
        component: (({ register }: HomepageTabExtensionProps) => {
          useEffect(() => register({ id: 'plugin-tab', label: 'Plugin tab' }), [register]);
          return null;
        }) as React.ComponentType,
      },
      PluginExtensionPoints.HomepageTabs
    );

    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.HomepageTabs ? [tabComponent] : [],
    }));

    render(<HomePage />);

    // Built-in tabs still render once the tab list settles...
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    // ...but the redesigned homepage ignores the HomepageTabs extension point.
    expect(screen.queryByRole('tab', { name: 'Plugin tab' })).not.toBeInTheDocument();
  });

  it('starts card placement while extensions are still loading and hands it to the overview', async () => {
    setTestFlags({ 'grafana.growthHomepage': true });
    setPluginComponentsHook(() => ({ components: [], isLoading: true }));
    const { datasource, needsAttention } = stubMetricsSolution();

    const { rerender } = render(<HomePage />);

    // The whole-page skeleton is up, yet detection is already running. Only placement reads
    // needsAttention, so a call at this point proves detection started at mount.
    await waitFor(() => expect(needsAttention).toHaveBeenCalledTimes(1));
    expect(datasource).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('home-page-skeleton')).toBeInTheDocument();

    setPluginComponentsHook(() => ({ components: [], isLoading: false }));
    rerender(<HomePage />);

    // The card renders once the extensions settle.
    expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();
  });

  it('renders the dashboards grid above the stack overview on the redesigned homepage', async () => {
    setTestFlags({ 'grafana.growthHomepage': true });
    jest.mocked(useHomepageSolutions).mockReturnValue({ solutions: [stubSolution('metrics')], signals: jest.fn() });

    render(<HomePage />);

    const dashboards = await screen.findByRole('heading', { name: 'Dashboards' });
    const overview = await screen.findByRole('heading', { name: 'Your observability stack overview' });
    expect(dashboards.compareDocumentPosition(overview)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe('solutions gating', () => {
    const renderWithStubSolution = () => {
      setTestFlags({ 'grafana.growthHomepage': true });
      const { datasource } = stubMetricsSolution();

      render(<HomePage />);
      return { datasource };
    };

    it('hides recommendations and the overview and skips placement for anonymous users', async () => {
      jest.replaceProperty(contextSrv, 'isSignedIn', false);

      const { datasource } = renderWithStubSolution();

      // The rest of the page still renders...
      expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
      // ...without the solutions sections or their placement probes.
      expect(screen.queryByRole('heading', { name: /your observability stack overview/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Metrics & infrastructure' })).not.toBeInTheDocument();
      expect(datasource).not.toHaveBeenCalled();
    });

    it('hides recommendations and the overview and skips placement for users with no org role', async () => {
      jest.replaceProperty(contextSrv.user, 'orgRole', OrgRole.None);

      const { datasource } = renderWithStubSolution();

      expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /your observability stack overview/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Metrics & infrastructure' })).not.toBeInTheDocument();
      expect(datasource).not.toHaveBeenCalled();
    });

    it('renders the overview for a signed-in org member', async () => {
      const { datasource } = renderWithStubSolution();

      expect(await screen.findByRole('heading', { name: /your observability stack overview/i })).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();
      expect(datasource).toHaveBeenCalled();
    });
  });

  it('keeps the skeleton up while a lazy extension component loads instead of unmounting the page', async () => {
    let resolveComponent!: (module: { default: ComponentType<{}> }) => void;
    const LazyExtension = lazy(
      () =>
        new Promise<{ default: ComponentType<{}> }>((resolve) => {
          resolveComponent = resolve;
        })
    );
    const lazyComponent = createComponentWithMeta(
      { pluginId: 'grafana-assistant-app', title: 'Lazy assistant', component: LazyExtension },
      PluginExtensionPoints.HomepageAssistant
    );

    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.HomepageAssistant ? [lazyComponent] : [],
    }));

    render(<HomePage />);

    // While the lazy extension is pending, the local Suspense fallback shows the skeleton
    // and the greeting stays — the suspension must not bubble to the route-level spinner.
    expect(screen.getByRole('heading', { name: /^Good \w+\.$/ })).toBeInTheDocument();
    expect(screen.getByTestId('home-page-skeleton')).toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();

    await act(async () => {
      resolveComponent({ default: () => <div>Lazy assistant content</div> });
    });

    // Reveal waits only for the lazy extension to resolve; the dashboard list loads inside
    // DashboardTabs. The final paint shows the resolved lazy content, built-in tabs, and no skeleton.
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText('Lazy assistant content')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).toHaveBeenCalledTimes(1);
  });
});
