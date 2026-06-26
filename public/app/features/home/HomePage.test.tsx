import { http, HttpResponse } from 'msw';
import { type ComponentType, lazy, useEffect } from 'react';
import { act, render, screen, waitFor, within } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints, type UserStorage } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { useUserStorage } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import HomePage from './HomePage';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useUserStorage: jest.fn(),
}));

// Curated widgets probe installed plugins through these hooks. Mock them so HomePage renders do not
// fire plugin-settings network requests, whose pending async would otherwise leak across tests.
jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  useIrmPlugin: () => ({ pluginId: 'grafana-irm-app', loading: false, installed: false }),
  usePluginBridge: () => ({ loading: false, installed: false }),
}));

setBackendSrv(backendSrv);
setupMockServer();

// In-memory stand-in for per-user widget storage; getItem reads the latest value at call time.
let storedLayout: string | null;
let setItemMock: jest.Mock;
const LEGACY_HOMEPAGE_PRE_EXTENSION_POINT = 'grafana/homepage/pre/v1';

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));

  // Deny alerting permission so the alerts widget is not in the catalog
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

  storedLayout = null;
  setItemMock = jest.fn((_key: string, value: string) => {
    storedLayout = value;
    return Promise.resolve();
  });
  jest.mocked(useUserStorage).mockReturnValue({
    getItem: jest.fn((): Promise<string | null> => Promise.resolve(storedLayout)),
    setItem: setItemMock,
  } satisfies UserStorage);

  // Stub endpoints widgets may touch: team filter, alertmanager alerts, and a catch-all plugin-settings
  // 404. Curated plugin detection is also mocked at module scope, so curated widgets stay absent.
  server.use(
    http.get('/api/user/teams', () => HttpResponse.json([])),
    http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json([])),
    http.get('/api/plugins/:pluginId/settings', () =>
      HttpResponse.json({ message: 'Plugin not found' }, { status: 404 })
    )
  );
});

const createHomepageExtensionComponent = (
  pluginId: string,
  content: string,
  extensionPointId: string
): ComponentTypeWithExtensionMeta<{}> =>
  createComponentWithMeta(
    {
      pluginId,
      title: content,
      component: () => <div>{content}</div>,
    },
    extensionPointId
  );

function expectDocumentOrder(before: HTMLElement, after: HTMLElement) {
  expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

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

  it('renders the OSS welcome message', async () => {
    config.buildInfo.edition = GrafanaEdition.OpenSource;

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana.')).toBeInTheDocument();
  });

  it('renders the dashboards widget from a stored layout', async () => {
    storedLayout = JSON.stringify({ version: 1, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] });

    render(<HomePage />);

    expect(await screen.findByRole('tab', { name: /recent/i })).toBeInTheDocument();
    // Wait for DashboardTabs to finish loading and auto-switch to Starred so its async work settles
    // inside the test and does not leak into later tests in the suite.
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
  });

  it('renders the customize toolbar before dashboards and keeps dashboards before the remaining widgets', async () => {
    storedLayout = JSON.stringify({
      version: 1,
      items: [
        { id: 'alerts', x: 0, y: 0, w: 12, h: 8 },
        { id: 'dashboards', x: 0, y: 8, w: 24, h: 10 },
      ],
    });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    render(<HomePage />);

    const customize = await screen.findByRole('button', { name: /customize/i });
    const dashboardTabs = await screen.findByRole('tab', { name: /recent/i });
    const alerts = await screen.findByText('Firing alerts');

    expectDocumentOrder(customize, dashboardTabs);
    expectDocumentOrder(dashboardTabs, alerts);
  });

  it('enters edit mode and lists only addable widgets in the drawer', async () => {
    storedLayout = JSON.stringify({ version: 1, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] });
    // Alerting permission makes the Firing alerts widget addable (the suite denies it by default).
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    const { user } = render(<HomePage />);
    // Settle the dashboards widget before interacting.
    await screen.findByRole('tab', { name: /starred/i, selected: true });

    await user.click(screen.getByRole('button', { name: /customize/i }));
    await user.click(screen.getByRole('button', { name: /add widget/i }));

    const drawer = await screen.findByRole('dialog');
    // Firing alerts is addable; the already-placed Dashboards widget is filtered out of the drawer.
    expect(within(drawer).getByText('Firing alerts')).toBeInTheDocument();
    expect(within(drawer).queryByText('Dashboards')).not.toBeInTheDocument();
  });

  it('keeps the dashboards widget mounted when adding and removing other widgets', async () => {
    storedLayout = JSON.stringify({ version: 1, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    const { user } = render(<HomePage />);

    await screen.findByRole('tab', { name: /starred/i, selected: true });
    expect(screen.queryByTestId('dashboard-tabs-skeleton')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /customize/i }));
    await user.click(screen.getByRole('button', { name: /add widget/i }));

    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('button', { name: /^add$/i }));
    await waitFor(() =>
      expect(setItemMock).toHaveBeenLastCalledWith('widget-layout', expect.stringContaining('"alerts"'))
    );
    await user.click(within(drawer).getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(screen.getByText('Firing alerts')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tabs-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: /remove widget/i });
    expect(removeButtons).toHaveLength(2);
    await user.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() => expect(screen.queryByText('Firing alerts')).not.toBeInTheDocument());
    expect(screen.queryByTestId('dashboard-tabs-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
  });

  it('shows the persona chooser on first run and seeds a layout when a persona is chosen', async () => {
    const { user } = render(<HomePage />);

    // No stored layout => first run => persona chooser.
    expect(await screen.findByText('Incident response')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure monitoring')).toBeInTheDocument();
    expect(screen.getByText('Service reliability')).toBeInTheDocument();
    expect(screen.getByText('Dashboards')).toBeInTheDocument();

    await user.click(screen.getByText('Incident response'));

    // The persona seeds the dashboards widget — the only catalog entry available here (no alerting permission, no IRM).
    expect(await screen.findByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(setItemMock).toHaveBeenCalledWith('widget-layout', expect.stringContaining('dashboards'));
    // Let DashboardTabs settle (auto-switch to Starred) before the test ends.
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
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

  it('does not render legacy homepage pre extension components as page-level sections', async () => {
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === LEGACY_HOMEPAGE_PRE_EXTENSION_POINT
          ? [
              createHomepageExtensionComponent(
                'grafana-setupguide-app',
                'Homepage pre extension',
                LEGACY_HOMEPAGE_PRE_EXTENSION_POINT
              ),
              createHomepageExtensionComponent(
                'grafana-untrusted-app',
                'Untrusted homepage pre extension',
                LEGACY_HOMEPAGE_PRE_EXTENSION_POINT
              ),
            ]
          : [],
    }));

    render(<HomePage />);

    await screen.findByText('Get started');
    expect(screen.queryByText('Homepage pre extension')).not.toBeInTheDocument();
    expect(screen.queryByText('Untrusted homepage pre extension')).not.toBeInTheDocument();
  });

  it('renders the homepage assistant extension inside the dashboards card', async () => {
    storedLayout = JSON.stringify({ version: 1, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] });
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.HomepageAssistant
          ? [
              createHomepageExtensionComponent(
                'grafana-assistant-app',
                'Assistant prompt',
                PluginExtensionPoints.HomepageAssistant
              ),
              createHomepageExtensionComponent(
                'grafana-untrusted-app',
                'Untrusted assistant extension',
                PluginExtensionPoints.HomepageAssistant
              ),
            ]
          : [],
    }));

    render(<HomePage />);

    const customize = await screen.findByRole('button', { name: /customize/i });
    const assistant = await screen.findByText('Assistant prompt');
    const dashboardTabs = await screen.findByRole('tab', { name: /recent/i });

    expectDocumentOrder(customize, assistant);
    expectDocumentOrder(assistant, dashboardTabs);
    // renderLimitedComponents only renders components from the trusted Assistant plugin id.
    expect(screen.queryByText('Untrusted assistant extension')).not.toBeInTheDocument();
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

    // Settle the layout hook's async load (the persona chooser) inside act before asserting.
    await screen.findByText('Get started');
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
    storedLayout = JSON.stringify({ version: 1, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] });
    setPluginComponentsHook(() => ({ components: [], isLoading: true }));

    render(<HomePage />);

    expect(await screen.findByTestId('home-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('reveals extension tabs together with the built-in tabs', async () => {
    storedLayout = JSON.stringify({ version: 1, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] });
    const tabComponent = createComponentWithMeta(
      {
        pluginId: 'grafana-setupguide-app',
        title: 'Plugin tab',
        component: (({ register }: HomepageTabExtensionProps) => {
          useEffect(() => register({ id: 'plugin-tab', label: 'Plugin tab' }), [register]);
          return null;
        }) as ComponentType,
      },
      PluginExtensionPoints.HomepageTabs
    );

    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.HomepageTabs ? [tabComponent] : [],
    }));

    render(<HomePage />);

    expect(await screen.findByRole('tab', { name: 'Plugin tab' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
  });

  it('keeps the skeleton up while a lazy extension component loads instead of unmounting the page', async () => {
    storedLayout = JSON.stringify({ version: 1, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] });
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

    expect(await screen.findByRole('heading', { name: /^Good \w+\.$/ })).toBeInTheDocument();
    expect(screen.getByTestId('home-page-skeleton')).toBeInTheDocument();

    await act(async () => {
      resolveComponent({ default: () => <div>Lazy assistant content</div> });
    });

    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText('Lazy assistant content')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
  });
});
