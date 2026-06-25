import { http, HttpResponse } from 'msw';
import { type ComponentType, lazy, useEffect } from 'react';
import { act, render, screen } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import HomePage from './HomePage';

setBackendSrv(backendSrv);
setupMockServer();

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));

  // Deny alerting permission so the FiringAlertsCard renders null
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
  // Stub endpoints the alerts/incidents cards probe so unhandled requests don't fail the test
  server.use(
    http.get('/api/user/teams', () => HttpResponse.json([])),
    http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json([])),
    // IncidentsCard checks the IRM/Incident plugins; report them absent so it renders nothing
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

  it('renders dashboard tabs and auto-switches to starred', async () => {
    render(<HomePage />);
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i })).toBeInTheDocument();

    // Default mocks have starred dashboards but no recent impressions,
    // so auto-switch activates the Starred tab
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

  it('renders homepage pre extension components', async () => {
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.HomepagePre
          ? [
              createHomepageExtensionComponent(
                'grafana-setupguide-app',
                'Homepage pre extension',
                PluginExtensionPoints.HomepagePre
              ),
              createHomepageExtensionComponent(
                'grafana-untrusted-app',
                'Untrusted homepage pre extension',
                PluginExtensionPoints.HomepagePre
              ),
            ]
          : [],
    }));

    render(<HomePage />);

    expect(await screen.findByText('Homepage pre extension')).toBeInTheDocument();
    expect(screen.queryByText('Untrusted homepage pre extension')).not.toBeInTheDocument();
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

    expect(await screen.findByText('Homepage extra extension 1')).toBeInTheDocument();
    expect(await screen.findByText('Homepage extra extension 2')).toBeInTheDocument();
    expect(screen.queryByText('Untrusted homepage extra extension')).not.toBeInTheDocument();
  });

  it('renders a skeleton instead of the page content while extensions are loading', async () => {
    setPluginComponentsHook(() => ({ components: [], isLoading: true }));

    render(<HomePage />);

    expect(await screen.findByTestId('home-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
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

    // render() flushes effects, so the extension tab must already be registered
    // and visible in the same reveal as the built-in tabs — no later pop-in
    expect(screen.getByRole('tab', { name: 'Plugin tab' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton')).not.toBeInTheDocument();

    // let the dashboard fetches settle to avoid act() warnings
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
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
      { pluginId: 'grafana-setupguide-app', title: 'Lazy pre', component: LazyExtension },
      PluginExtensionPoints.HomepagePre
    );

    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.HomepagePre ? [lazyComponent] : [],
    }));

    render(<HomePage />);

    // While the lazy extension is pending, the page chrome stays mounted and the
    // skeleton stays visible — the suspension must not bubble to the route level
    expect(screen.getByRole('heading', { name: /^Good \w+\.$/ })).toBeInTheDocument();
    expect(screen.getByTestId('home-page-skeleton')).toBeInTheDocument();

    await act(async () => {
      resolveComponent({ default: () => <div>Lazy pre content</div> });
    });

    expect(await screen.findByText('Lazy pre content')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();

    // let the dashboard fetches settle to avoid act() warnings
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
  });
});
