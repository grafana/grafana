import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep } from 'lodash';
import { useParams } from 'react-router-dom-v5-compat';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { type PanelProps, store, systemDateFormats, type SystemDateFormatsState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import {
  LocationServiceProvider,
  locationSearchToObject,
  locationService,
  setPluginImportUtils,
} from '@grafana/runtime';
import { setGetObservablePluginLinks, setPanelPluginMetas } from '@grafana/runtime/internal';
import { VizPanel } from '@grafana/scenes';
import { type Dashboard, type LibraryPanel } from '@grafana/schema';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';
import { type GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { type DashboardLoaderSrv, setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import * as libraryPanels from 'app/features/library-panels/state/api';
import { DASHBOARD_FROM_LS_KEY, DashboardRoutes } from 'app/types/dashboard';

import { setPublicDashboardConfigFn } from '../../dashboard/components/PublicDashboard/usePublicDashboardConfig';
import { dashboardViews } from '../scene/dashboardViewRegistry';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { createDeferred, setupLoadDashboardMockReject, setupLoadDashboardRuntimeErrorMock } from '../utils/test-utils';

import { DashboardScenePage, type Props } from './DashboardScenePage';
import {
  DashboardScenePageStateManager,
  DashboardScenePageStateManagerV2,
  getDashboardScenePageStateManager,
} from './DashboardScenePageStateManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  useChromeHeaderHeight: jest.fn().mockReturnValue(80),
  getBackendSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({ dashboard: simpleDashboard, meta: { url: '' } }),
    };
  },
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({}),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
}));

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn().mockReturnValue({ uid: 'my-dash-uid' }),
}));

const getObservablePluginLinks = jest.fn().mockReturnValue(of([]));
setGetObservablePluginLinks(getObservablePluginLinks);

function setup({ routeProps }: { routeProps?: Partial<GrafanaRouteComponentProps> } = {}) {
  const context = getGrafanaContextMock();
  const defaultRouteProps = getRouteComponentProps();
  const props: Props = {
    ...defaultRouteProps,
    ...routeProps,
  };

  const renderResult = render(
    <TestProvider grafanaContext={context}>
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <LocationServiceProvider service={locationService}>
          <DashboardScenePage {...props} />
        </LocationServiceProvider>
      </OpenFeatureProvider>
    </TestProvider>
  );

  const rerender = (newProps: Props) => {
    renderResult.rerender(
      <TestProvider grafanaContext={context}>
        <OpenFeatureProvider client={getTestFeatureFlagClient()}>
          <LocationServiceProvider service={locationService}>
            <DashboardScenePage {...newProps} />
          </LocationServiceProvider>
        </OpenFeatureProvider>
      </TestProvider>
    );
  };

  return { rerender, context, props, unmount: renderResult.unmount };
}

const simpleDashboard: Dashboard = {
  title: 'My cool dashboard',
  uid: 'my-dash-uid',
  schemaVersion: 30,
  version: 1,
  panels: [
    {
      id: 1,
      type: 'custom-viz-panel',
      title: 'Panel A',
      options: {
        content: `Content A`,
      },
      gridPos: {
        x: 0,
        y: 0,
        w: 10,
        h: 10,
      },
      targets: [],
    },
    {
      id: 2,
      type: 'custom-viz-panel',
      title: 'Panel B',
      options: {
        content: `Content B`,
      },
      gridPos: {
        x: 0,
        y: 10,
        w: 10,
        h: 10,
      },
      targets: [],
    },
  ],
};

const panelPlugin = getPanelPlugin(
  {
    skipDataQuery: true,
  },
  CustomVizPanel
);
panelPlugin.meta.info.logos.small = 'public/build/img/grafana_icon.svg';

beforeEach(() => {
  setPanelPluginMetas({ 'custom-viz-panel': panelPlugin.meta });
});

afterEach(() => {
  setPanelPluginMetas({});
});

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(panelPlugin),
  getPanelPluginFromCache: (id: string) => undefined,
});

const loadDashboardMock = jest.fn();

setDashboardLoaderSrv({
  loadDashboard: loadDashboardMock,
  // disabling type checks since this is a test util
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
} as unknown as DashboardLoaderSrv);

describe('DashboardScenePage', () => {
  beforeEach(() => {
    // getBackendSrv is stubbed with a v1 DTO, and the page manager singleton is created on first use.
    // New layouts load through the v2 client, which reads metadata.annotations on that body.
    setTestFlags({ dashboardNewLayouts: false });
    setPublicDashboardConfigFn({
      footerHide: false,
      footerText: 'Powered by',
      footerLogo: 'grafana-logo',
      footerLink: 'https://grafana.com/?src=grafananet&cnt=public-dashboards',
      headerLogoHide: false,
    });
    locationService.push('/d/my-dash-uid');
    getDashboardScenePageStateManager().clearDashboardCache();
    getDashboardScenePageStateManager().clearSceneCache();
    loadDashboardMock.mockClear();
    loadDashboardMock.mockResolvedValue({ dashboard: simpleDashboard, meta: { slug: '123' } });
    // hacky way because mocking autosizer does not work
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });
    getObservablePluginLinks.mockRestore();
    getObservablePluginLinks.mockReturnValue(of([]));
    store.delete(DASHBOARD_FROM_LS_KEY);
  });

  afterEach(() => {
    // Testing Library unmounts after this hook, so DashboardScenePage is still mounted.
    // setTestFlags({}) would turn dashboardNewLayouts back on and re-render it. cleanup() unmounts that page first.
    cleanup();
    setTestFlags({});
  });

  it('Can render dashboard', async () => {
    setup();

    await waitForDashboardToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
    expect(await screen.findByText('Content A')).toBeInTheDocument();

    expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
    expect(await screen.findByText('Content B')).toBeInTheDocument();
  });

  it('keeps the page loader until the editor is ready and opens it only once when the URL normalizes', async () => {
    loadDashboardMock.mockResolvedValue({ dashboard: cloneDeep(simpleDashboard), meta: { slug: '123' } });
    const pending = createDeferred<void>();
    const original = dashboardViews.editPanel;
    const loadEditor = jest.spyOn(dashboardViews, 'editPanel').mockImplementation((...args) => {
      const view = original(...args);
      return {
        ...view,
        load: async (signal) => {
          await pending.promise;
          return view.load(signal);
        },
      };
    });
    locationService.push('/d/my-dash-uid?editPanel=panel-1&from=now-6h&to=now&var-team=frontend');
    try {
      setup();
      await waitFor(() => expect(loadEditor).toHaveBeenCalled());
      expect(screen.getByText('Loading ...')).toBeInTheDocument();
      expect(screen.queryByTitle('Panel B')).not.toBeInTheDocument();
      await act(async () => pending.resolve());
      expect(await screen.findByText('Panel options')).toBeInTheDocument();
      expect(loadEditor).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Panel B')).not.toBeInTheDocument();
      expect(locationService.getSearchObject()).toMatchObject({
        editPanel: '1',
        from: 'now-6h',
        to: 'now',
        'var-team': 'frontend',
      });
    } finally {
      loadEditor.mockRestore();
    }
  });

  it('restores dashboard scroll position after loading and closing the panel editor', async () => {
    const ready = createDeferred<void>();
    const original = dashboardViews.editPanel;
    const loadEditor = jest.spyOn(dashboardViews, 'editPanel').mockImplementation((...args) => {
      const view = original(...args);
      return {
        ...view,
        load: async (signal) => {
          await ready.promise;
          return view.load(signal);
        },
      };
    });
    try {
      setup();
      expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
      const scene = getDashboardScenePageStateManager().getCache()['my-dash-uid'];
      const scroll = { scrollTop: 420, scrollTo: jest.fn() };
      scene.onSetScrollRef(scroll);
      // Keep a measurable scroll surface across Page remounts; jsdom has no layout or scrolling.
      const setScrollRef = jest.spyOn(scene, 'onSetScrollRef').mockImplementation(() => {});
      const remember = jest.spyOn(scene, 'rememberScrollPos');
      const restore = jest.spyOn(scene, 'restoreScrollPos');
      try {
        act(() => locationService.partial({ editPanel: 'panel-1' }));
        expect(await screen.findByText('Loading ...')).toBeInTheDocument();
        expect(remember).toHaveBeenCalledTimes(1);
        scroll.scrollTop = 0;
        await act(async () => ready.resolve());
        expect(await screen.findByText('Panel options')).toBeInTheDocument();
        expect(remember).toHaveBeenCalledTimes(1);
        expect(restore).not.toHaveBeenCalled();
        act(() => locationService.partial({ editPanel: null }));
        expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
        expect(scroll.scrollTo).toHaveBeenCalledWith(0, 420);
      } finally {
        setScrollRef.mockRestore();
        remember.mockRestore();
        restore.mockRestore();
      }
    } finally {
      cleanup();
      loadEditor.mockRestore();
    }
  });

  it('leaves the page loader when editing a mounted library panel whose fetch fails', async () => {
    const { pending, fetchPanel } = mockPendingLibraryPanel();

    try {
      setup();
      expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
      expect(fetchPanel).toHaveBeenCalledWith('library-a', true);
      act(() => locationService.partial({ editPanel: 'panel-1' }));
      expect(await screen.findByText('Loading ...')).toBeInTheDocument();
      expect(screen.queryByTitle('Panel B')).not.toBeInTheDocument();

      await act(async () => pending.reject(new Error('Library panel unavailable')));

      expect(await screen.findByTestId(selectors.components.Panels.Panel.status('error'))).toBeInTheDocument();
      expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
    } finally {
      cleanup();
      fetchPanel.mockRestore();
    }
  });

  it.each(['mounted dashboard', 'direct URL'])(
    'keeps the loader through library resolution and editor loading from a %s',
    async (entry) => {
      const { pending, fetchPanel, libraryPanel } = mockPendingLibraryPanel();
      const editorReady = createDeferred<void>();
      const original = dashboardViews.editPanel;
      const loadEditor = jest.spyOn(dashboardViews, 'editPanel').mockImplementation((...args) => {
        const view = original(...args);
        return {
          ...view,
          load: async (signal) => {
            await editorReady.promise;
            return view.load(signal);
          },
        };
      });

      try {
        if (entry === 'direct URL') {
          locationService.partial({ editPanel: 'panel-1' });
        }
        setup();
        if (entry === 'mounted dashboard') {
          expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
          act(() => locationService.partial({ editPanel: 'panel-1' }));
        }
        await waitFor(() => expect(fetchPanel).toHaveBeenCalledWith('library-a', true));
        const loader = screen.getByText('Loading ...');
        expect(screen.queryByTitle('Panel B')).not.toBeInTheDocument();

        await act(async () => pending.resolve(libraryPanel));

        await waitFor(() => expect(loadEditor).toHaveBeenCalled());
        expect(loader).toBeInTheDocument();
        expect(screen.queryByTitle('Panel B')).not.toBeInTheDocument();
        expect(screen.queryByText('Panel options')).not.toBeInTheDocument();

        await act(async () => editorReady.resolve());

        expect(await screen.findByText('Panel options')).toBeInTheDocument();
        expect(screen.queryByTitle('Panel B')).not.toBeInTheDocument();
        expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
      } finally {
        cleanup();
        fetchPanel.mockRestore();
        loadEditor.mockRestore();
      }
    }
  );

  it.each([
    { action: 'closing', editPanel: undefined },
    { action: 'replacing', editPanel: 'panel-2' },
  ])('ignores a late library response after $action the pending editor', async ({ editPanel }) => {
    const { pending, fetchPanel, libraryPanel } = mockPendingLibraryPanel();

    try {
      const { unmount } = setup();
      expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
      const scene = getDashboardScenePageStateManager().getCache()['my-dash-uid'];
      const panel = dashboardSceneGraph.getVizPanels(scene)[0];
      act(() => locationService.partial({ editPanel: 'panel-1' }));
      expect(await screen.findByText('Loading ...')).toBeInTheDocument();

      act(() => locationService.partial({ editPanel }));

      expect(await screen.findByText(editPanel ? 'Panel options' : 'Content B')).toBeInTheDocument();
      expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
      expect(locationService.getSearchObject().editPanel).toBe(editPanel ? '2' : undefined);
      if (editPanel) {
        expect(panel.isActive).toBe(false);
      }
      await act(async () => pending.resolve(libraryPanel));
      expect(scene.state.editPanel?.state.panelRef.resolve().state.key).toBe(editPanel);
      expect(screen.getByText(editPanel ? 'Panel options' : 'Content B')).toBeInTheDocument();

      unmount();
      expect(panel.isActive).toBe(false);
    } finally {
      cleanup();
      fetchPanel.mockRestore();
    }
  });

  it.each(['library fetch', 'editor bundle'])(
    'preserves the replacement editor URL and loader while the previous %s finishes',
    async (phase) => {
      const { pending, fetchPanel, libraryPanel } = mockPendingLibraryPanel();
      const firstEditorReady = createDeferred<void>();
      const secondEditorReady = createDeferred<void>();
      const original = dashboardViews.editPanel;
      const loadEditor = jest.spyOn(dashboardViews, 'editPanel').mockImplementation((...args) => {
        const view = original(...args);
        const ready = args[0].state.key === 'panel-1' ? firstEditorReady : secondEditorReady;
        return {
          ...view,
          load: async (signal) => {
            await ready.promise;
            return view.load(signal);
          },
        };
      });

      try {
        setup();
        expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
        act(() => locationService.partial({ editPanel: 'panel-1' }));
        const loader = await screen.findByText('Loading ...');
        if (phase === 'editor bundle') {
          await act(async () => pending.resolve(libraryPanel));
          expect(loadEditor).toHaveBeenCalledTimes(1);
        }

        act(() => locationService.partial({ editPanel: 'panel-2', 'var-team': 'frontend' }));

        expect(locationService.getSearchObject()).toMatchObject({ editPanel: 'panel-2', 'var-team': 'frontend' });
        expect(loader).toBeInTheDocument();
        expect(screen.queryByTitle('Panel B')).not.toBeInTheDocument();

        await act(async () => {
          pending.resolve(libraryPanel);
          firstEditorReady.resolve();
        });

        expect(loader).toBeInTheDocument();
        expect(locationService.getSearchObject().editPanel).toBe('panel-2');
        expect(screen.queryByText('Panel options')).not.toBeInTheDocument();
        await act(async () => secondEditorReady.resolve());

        expect(await screen.findByText('Panel options')).toBeInTheDocument();
        expect(locationService.getSearchObject()).toMatchObject({ editPanel: '2', 'var-team': 'frontend' });
        const scene = getDashboardScenePageStateManager().getCache()['my-dash-uid'];
        expect(scene.state.editPanel?.state.panelRef.resolve().state.key).toBe('panel-2');
        expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
      } finally {
        cleanup();
        fetchPanel.mockRestore();
        loadEditor.mockRestore();
      }
    }
  );

  it('shows Powered by footer in kiosk mode', async () => {
    setup({ routeProps: { queryParams: { kiosk: true } } });

    await waitForDashboardToRender();

    expect(await screen.findByTestId(selectors.pages.PublicDashboard.footer)).toBeInTheDocument();
  });

  it('shows kiosk Powered by footer even when public dashboard footerHide is enabled', async () => {
    setPublicDashboardConfigFn({
      footerHide: true,
      footerText: 'Powered by',
      footerLogo: 'grafana-logo',
      footerLink: 'https://grafana.com/?src=grafananet&cnt=public-dashboards',
      headerLogoHide: false,
    });

    setup({ routeProps: { queryParams: { kiosk: true } } });

    await waitForDashboardToRender();

    expect(await screen.findByTestId(selectors.pages.PublicDashboard.footer)).toBeInTheDocument();
  });

  it('shows Powered by footer when kiosk query param is present with no value (?kiosk)', async () => {
    setup({ routeProps: { queryParams: locationSearchToObject('?kiosk') } });

    await waitForDashboardToRender();

    expect(await screen.findByTestId(selectors.pages.PublicDashboard.footer)).toBeInTheDocument();
  });

  it('does not show Powered by footer when kiosk=false', async () => {
    setup({ routeProps: { queryParams: { kiosk: 'false' } } });

    await waitForDashboardToRender();

    expect(screen.queryByTestId(selectors.pages.PublicDashboard.footer)).not.toBeInTheDocument();
  });

  it('uses kiosk dashboard CTA url', async () => {
    setup({ routeProps: { queryParams: { kiosk: true } } });

    await waitForDashboardToRender();

    const footer = await screen.findByTestId(selectors.pages.PublicDashboard.footer);
    const link = footer.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://grafana.com/?src=grafananet&cnt=kiosk-dashboard');
  });

  it('hides Powered by footer in kiosk mode when hideLogo is present', async () => {
    setup({ routeProps: { queryParams: { kiosk: true, hideLogo: true } } });

    await waitForDashboardToRender();

    expect(screen.queryByTestId(selectors.pages.PublicDashboard.footer)).not.toBeInTheDocument();
  });

  it('routeReloadCounter should trigger reload', async () => {
    const { rerender, props } = setup();

    await waitForDashboardToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();

    const updatedDashboard = cloneDeep(simpleDashboard);
    updatedDashboard.version = 11;
    updatedDashboard.panels![0].title = 'Updated title';

    getDashboardScenePageStateManager().clearDashboardCache();
    loadDashboardMock.mockResolvedValue({ dashboard: updatedDashboard, meta: {} });

    props.location.state = { routeReloadCounter: 1 };

    rerender(props);

    expect(await screen.findByTitle('Updated title')).toBeInTheDocument();
  });

  it('Can inspect panel', async () => {
    setup();

    await waitForDashboardToRender();

    expect(screen.queryByText('Inspect: Panel B')).not.toBeInTheDocument();

    // Wish I could use the menu here but unable t get it to open when I click the menu button
    // Somethig with Dropdown that is not working inside react-testing
    await userEvent.click(screen.getByLabelText('Menu for panel Panel B'));

    const inspectMenuItem = await screen.findAllByText('Inspect');

    await userEvent.click(inspectMenuItem[0]);

    expect(await screen.findByText('Inspect: Panel B')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId(selectors.components.Drawer.General.close));

    expect(screen.queryByText('Inspect: Panel B')).not.toBeInTheDocument();
  });

  it('Can view panel in fullscreen', async () => {
    setup();

    await waitForDashboardToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();

    act(() => locationService.partial({ viewPanel: '2' }));

    expect(screen.queryByTitle('Panel A')).not.toBeInTheDocument();
    expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
  });

  describe('absolute time range', () => {
    it('should render with absolute time range when use_browser_locale is true', async () => {
      locationService.push('/d/my-dash-uid?from=2025-03-11T07:09:37.253Z&to=2025-03-12T07:09:37.253Z');
      systemDateFormats.update({
        fullDate: 'YYYY-MM-DD HH:mm:ss.SSS',
        interval: {} as SystemDateFormatsState['interval'],
        useBrowserLocale: true,
      });
      setup();

      await waitForDashboardToRenderWithTimeRange({
        from: '03/11/2025, 02:09:37 AM',
        to: '03/12/2025, 02:09:37 AM',
      });
    });

    it('should render correct time range when use_browser_locale is true and time range is other than default system date format', async () => {
      locationService.push('/d/my-dash-uid?from=2025-03-11T07:09:37.253Z&to=2025-03-12T07:09:37.253Z');
      // mocking navigator.languages to return 'de'
      // this property configured in the browser settings
      Object.defineProperty(navigator, 'languages', { value: ['de'] });
      systemDateFormats.update({
        // left fullDate empty to show that this should be overridden by the browser locale
        fullDate: '',
        interval: {} as SystemDateFormatsState['interval'],
        useBrowserLocale: true,
      });
      setup();

      await waitForDashboardToRenderWithTimeRange({
        from: '11.03.2025, 02:09:37',
        to: '12.03.2025, 02:09:37',
      });
    });
  });

  describe('empty state', () => {
    it('Shows empty state when dashboard is empty', async () => {
      loadDashboardMock.mockResolvedValue({ dashboard: { uid: 'my-dash-uid', panels: [] }, meta: {} });
      setup();

      expect(await screen.findByText('Start your new dashboard by adding a visualization')).toBeInTheDocument();
    });

    it('shows and hides empty state when panels are added and removed', async () => {
      setup();

      await waitForDashboardToRender();

      expect(screen.queryByText('Start your new dashboard by adding a visualization')).not.toBeInTheDocument();

      // Hacking a bit, accessing private cache property to get access to the underlying DashboardScene object
      const dashboardScenesCache = getDashboardScenePageStateManager().getCache();
      const dashboard = dashboardScenesCache['my-dash-uid'];
      const panels = dashboardSceneGraph.getVizPanels(dashboard);

      act(() => {
        dashboard.removePanel(panels[0]);
      });
      expect(screen.queryByText('Start your new dashboard by adding a visualization')).not.toBeInTheDocument();

      act(() => {
        dashboard.removePanel(panels[1]);
      });
      expect(await screen.findByText('Start your new dashboard by adding a visualization')).toBeInTheDocument();

      act(() => {
        dashboard.addPanel(new VizPanel({ title: 'Panel Added', key: 'panel-4', pluginId: 'timeseries' }));
      });

      expect(await screen.findByTitle('Panel Added')).toBeInTheDocument();
      expect(screen.queryByText('Start your new dashboard by adding a visualization')).not.toBeInTheDocument();
    });
  });

  describe('home page', () => {
    it('should render the dashboard when the route is home', async () => {
      (useParams as jest.Mock).mockReturnValue({});
      setup({
        routeProps: {
          route: {
            ...getRouteComponentProps().route,
            routeName: DashboardRoutes.Home,
          },
        },
      });

      await waitForDashboardToRender();

      expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
      expect(await screen.findByText('Content A')).toBeInTheDocument();

      expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
      expect(await screen.findByText('Content B')).toBeInTheDocument();
    });

    it('should show controls', async () => {
      getDashboardScenePageStateManager().clearDashboardCache();
      loadDashboardMock.mockClear();
      loadDashboardMock.mockResolvedValue({ dashboard: { uid: 'my-dash-uid', panels: [] }, meta: {} });

      setup();

      await waitFor(() => expect(screen.queryByText('Refresh')).toBeInTheDocument());
      await waitFor(() => expect(screen.queryByText('Last 6 hours')).toBeInTheDocument());
    });
  });

  describe('errors rendering', () => {
    const origError = console.error;
    const consoleErrorMock = jest.fn();
    afterEach(() => (console.error = origError));
    beforeEach(() => (console.error = consoleErrorMock));

    it('should render dashboard not found notice when dashboard... not found', async () => {
      setupLoadDashboardMockReject({
        status: 404,
        statusText: 'Not Found',
        data: {
          message: 'Dashboard not found',
        },
        config: {
          method: 'GET',
          url: 'api/dashboards/uid/adfjq9edwm0hsdsa',
          retry: 0,
          headers: {
            'X-Grafana-Org-Id': 1,
          },
          hideFromInspector: true,
        },
        isHandled: true,
      });

      setup();

      expect(await screen.findByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
    });

    it('should render error alert for backend errors', async () => {
      setupLoadDashboardMockReject({
        status: 500,
        statusText: 'internal server error',
        data: {
          message: 'Internal server error',
        },
        config: {
          method: 'GET',
          url: 'api/dashboards/uid/adfjq9edwm0hsdsa',
          retry: 0,
          headers: {
            'X-Grafana-Org-Id': 1,
          },
          hideFromInspector: true,
        },
        isHandled: true,
      });

      setup();

      expect(await screen.findByTestId('dashboard-page-error')).toBeInTheDocument();
      expect(await screen.findByTestId('dashboard-page-error')).toHaveTextContent('Internal server error');
    });

    it('should render error alert for runtime errors', async () => {
      setupLoadDashboardRuntimeErrorMock();

      setup();

      expect(await screen.findByTestId('dashboard-page-error')).toBeInTheDocument();
      expect(await screen.findByTestId('dashboard-page-error')).toHaveTextContent('Runtime error');
    });
  });

  describe('UnifiedDashboardScenePageStateManager', () => {
    it('should reset active manager when unmounting', async () => {
      const manager = getDashboardScenePageStateManager();
      manager.setActiveManager('v2');

      // This test is only validating manager cleanup on unmount.
      // Prevent the component from triggering a real v2 dashboard load (which requires extra setup).
      const loadDashboardSpy = jest.spyOn(manager, 'loadDashboard').mockResolvedValue(undefined);

      try {
        const { unmount } = setup();

        expect(manager['activeManager']).toBeInstanceOf(DashboardScenePageStateManagerV2);
        unmount();
        expect(manager['activeManager']).toBeInstanceOf(DashboardScenePageStateManager);
      } finally {
        loadDashboardSpy.mockRestore();
      }
    });
  });
});

function mockPendingLibraryPanel() {
  const dashboard = cloneDeep(simpleDashboard);
  dashboard.panels![0] = { ...dashboard.panels![0], libraryPanel: { uid: 'library-a', name: 'Library A' } };
  loadDashboardMock.mockResolvedValue({ dashboard, meta: { slug: '123', canEdit: true } });
  const pending = createDeferred<LibraryPanel>();
  const fetchPanel = jest.spyOn(libraryPanels, 'getLibraryPanel').mockReturnValue(pending.promise);
  const libraryPanel: LibraryPanel = {
    uid: 'library-a',
    name: 'Library A',
    type: 'custom-viz-panel',
    version: 1,
    model: {
      type: 'custom-viz-panel',
      title: 'Panel A',
      options: { content: 'Library content' },
      fieldConfig: { defaults: {}, overrides: [] },
    },
  };
  return { pending, fetchPanel, libraryPanel };
}

interface VizOptions {
  content: string;
}
interface VizProps extends PanelProps<VizOptions> {}

function CustomVizPanel(props: VizProps) {
  return <div>{props.options.content}</div>;
}

async function waitForDashboardToRender() {
  expect(await screen.findByText('Last 6 hours')).toBeInTheDocument();
  expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
}

async function waitForDashboardToRenderWithTimeRange(timeRange: { from: string; to: string }) {
  expect(await screen.findByText(`${timeRange.from} to ${timeRange.to}`)).toBeInTheDocument();
  expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
}
