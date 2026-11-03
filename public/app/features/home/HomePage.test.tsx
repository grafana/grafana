import { http, HttpResponse } from 'msw';
import { type ComponentType, lazy, useEffect } from 'react';
import { act, render, screen, waitFor } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, OrgRole, PluginExtensionPoints, store } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { pluginMeta } from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { AccessControlAction } from 'app/types/accessControl';

import { ALERTS_FILTER_STORAGE_KEY, INCIDENTS_FILTER_STORAGE_KEY } from './AlertsIncidents/filterSelection';
import { ACTIVE_INCIDENTS_QUERY, mockIncidents, mockNoIncidentFields } from './AlertsIncidents/mockIncidentsApi';
import { mockCurrentUserEvents, mockSchedules } from './AlertsIncidents/mockOnCallSchedulesApi';
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

jest.mock('./useHomepageSolutions', () => ({
  ...jest.requireActual('./useHomepageSolutions'),
  useHomepageSolutions: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const mockUsePluginBridge = jest.mocked(usePluginBridge);

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  jest
    .mocked(useHomepageSolutions)
    .mockImplementation(jest.requireActual('./useHomepageSolutions').useHomepageSolutions);
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  mockUsePluginBridge.mockReturnValue({ installed: false, loading: false });

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

  afterEach(() => {
    config.buildInfo = { ...originalBuildInfo };
    config.namespace = originalNamespace;
    jest.restoreAllMocks();
  });

  it('renders the greeting', async () => {
    render(<HomePage />);
    expect(await screen.findByRole('heading', { name: /^Good \w+\.$/ })).toBeInTheDocument();
  });

  it('scopes firing alerts to the label stored in local storage', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action === AccessControlAction.AlertingInstanceRead);
    window.localStorage.setItem(ALERTS_FILTER_STORAGE_KEY, 'team:platform');
    const filters: string[][] = [];
    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        filters.push(new URL(request.url).searchParams.getAll('filter'));
        return HttpResponse.json([]);
      })
    );

    render(<HomePage />);

    await waitFor(() => expect(filters.length).toBeGreaterThan(0));
    expect(filters[0]).toEqual(['team="platform"']);
  });

  it('scopes active incidents to their own stored filter, not the alerts team', async () => {
    mockUsePluginBridge.mockReturnValue({
      installed: true,
      loading: false,
      settings: { ...pluginMeta[SupportedPlugin.Irm], includes: [] },
    });
    window.localStorage.setItem(ALERTS_FILTER_STORAGE_KEY, 'team:backend');
    window.localStorage.setItem(INCIDENTS_FILTER_STORAGE_KEY, 'squad:Frontend');
    const queries = mockIncidents([]);
    // With IRM installed the incidents and on-call tabs load their filter fields and schedules too.
    mockNoIncidentFields();
    mockCurrentUserEvents({ schedules: [] });
    mockSchedules({});

    render(<HomePage />);

    await waitFor(() => expect(queries).toHaveLength(1));
    expect(queries[0]).toBe(`${ACTIVE_INCIDENTS_QUERY} field:squad:"Frontend"`);
  });

  it('renders the OSS welcome message', async () => {
    config.buildInfo.edition = GrafanaEdition.OpenSource;

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana.')).toBeInTheDocument();
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
    // Built once: the registry hands out stable components, and a new type per render would remount the content.
    const assistantComponents = [
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
    ];
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.HomepageAssistant ? assistantComponents : [],
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

  it('renders every section while extensions are still loading, with the Assistant slot held for its input', async () => {
    setPluginComponentsHook(() => ({ components: [], isLoading: true }));
    const { needsAttention } = stubMetricsSolution();

    render(<HomePage />);

    // The tabs, the overview and placement all start at mount, and the Assistant slot is held while the registry
    // loads the plugin, so the input lands in place. The tabs' skeleton only lasts until their fetches settle.
    expect(screen.getByTestId('home-tabbed-card-skeleton')).toBeInTheDocument();
    expect(await screen.findByTestId('home-page-assistant-skeleton')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your observability stack overview/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();
    // Placement runs once, from the overview; nothing prefetches it a second time.
    expect(needsAttention).toHaveBeenCalledTimes(1);
    expect(jest.mocked(homepageViewed)).toHaveBeenCalledTimes(1);
  });

  it('drops the Assistant slot once the registry settles without an Assistant component', async () => {
    setPluginComponentsHook(() => ({ components: [], isLoading: true }));

    const { rerender } = render(<HomePage />);
    expect(await screen.findByTestId('home-page-assistant-skeleton')).toBeInTheDocument();

    // Nothing declared this slot: an instance without the Assistant.
    setPluginComponentsHook(() => ({ components: [], isLoading: false }));
    rerender(<HomePage />);

    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-assistant-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-page-assistant-slot')).not.toBeInTheDocument();
  });

  it('hides the Assistant slot while the plugin component renders nothing, as it does once the Assistant cannot be used', async () => {
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.HomepageAssistant
          ? [
              createComponentWithMeta(
                { pluginId: 'grafana-assistant-app', title: 'Assistant', component: () => null },
                PluginExtensionPoints.HomepageAssistant
              ),
            ]
          : [],
    }));

    render(<HomePage />);

    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    const slot = screen.getByTestId('home-page-assistant-slot');
    expect(slot).toBeEmptyDOMElement();
    expect(slot).toHaveStyle({ display: 'none' });
  });

  it('holds the Assistant slot while its lazy component loads instead of hiding the page', async () => {
    let resolveComponent!: (module: { default: ComponentType<{}> }) => void;
    const LazyExtension = lazy(
      () =>
        new Promise<{ default: ComponentType<{}> }>((resolve) => {
          resolveComponent = resolve;
        })
    );
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.HomepageAssistant
          ? [
              createComponentWithMeta(
                { pluginId: 'grafana-assistant-app', title: 'Lazy assistant', component: LazyExtension },
                PluginExtensionPoints.HomepageAssistant
              ),
            ]
          : [],
    }));

    render(<HomePage />);

    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByTestId('home-page-assistant-skeleton')).toBeInTheDocument();

    await act(async () => {
      resolveComponent({ default: () => <div>Lazy assistant content</div> });
    });

    expect(await screen.findByText('Lazy assistant content')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-assistant-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
  });

  it('keeps the Assistant input mounted across homepage re-renders', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action === AccessControlAction.AlertingInstanceRead);
    const filters: string[][] = [];
    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        filters.push(new URL(request.url).searchParams.getAll('filter'));
        return HttpResponse.json([]);
      })
    );
    const mounted = jest.fn();
    const CountingAssistant = () => {
      useEffect(() => {
        mounted();
      }, []);
      return <div>Assistant input</div>;
    };
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.HomepageAssistant
          ? [
              createComponentWithMeta(
                { pluginId: 'grafana-assistant-app', title: 'Assistant', component: CountingAssistant },
                PluginExtensionPoints.HomepageAssistant
              ),
            ]
          : [],
    }));

    render(<HomePage />);
    expect(await screen.findByText('Assistant input')).toBeInTheDocument();

    // A stored filter change re-renders the page (the alerts re-query proves it landed)...
    await act(async () => {
      store.set(ALERTS_FILTER_STORAGE_KEY, 'team:platform');
    });
    await waitFor(() => expect(filters).toContainEqual(['team="platform"']));

    // ...and the input survives it. A frame created inline per render would remount it, losing the typed prompt.
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('renders the jump-back-in grid above the stack overview', async () => {
    jest.mocked(useHomepageSolutions).mockReturnValue({ solutions: [stubSolution('metrics')], signals: jest.fn() });

    render(<HomePage />);

    const dashboards = await screen.findByRole('heading', { name: 'Jump back in' });
    const overview = await screen.findByRole('heading', { name: 'Your observability stack overview' });
    expect(dashboards.compareDocumentPosition(overview)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe('solutions gating', () => {
    const renderWithStubSolution = () => {
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
});
