import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep } from 'lodash';
import { useParams } from 'react-router-dom-v5-compat';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { PanelProps, systemDateFormats, SystemDateFormatsState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { LocationServiceProvider, config, locationService, setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import store from 'app/core/store';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DASHBOARD_FROM_LS_KEY, DashboardRoutes } from 'app/types/dashboard';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { setupLoadDashboardMockReject, setupLoadDashboardRuntimeErrorMock } from '../utils/test-utils';

import { DashboardScenePage, Props } from './DashboardScenePage';
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

const getPluginExtensionsMock = jest.fn().mockReturnValue({ extensions: [] });
jest.mock('app/features/plugins/extensions/getPluginExtensions', () => ({
  ...jest.requireActual('app/features/plugins/extensions/getPluginExtensions'),
  createPluginExtensionsGetter: () => getPluginExtensionsMock,
}));

function setup({ routeProps }: { routeProps?: Partial<GrafanaRouteComponentProps> } = {}) {
  const context = getGrafanaContextMock();
  const defaultRouteProps = getRouteComponentProps();
  const props: Props = {
    ...defaultRouteProps,
    ...routeProps,
  };

  const renderResult = render(
    <TestProvider grafanaContext={context}>
      <LocationServiceProvider service={locationService}>
        <DashboardScenePage {...props} />
      </LocationServiceProvider>
    </TestProvider>
  );

  const rerender = (newProps: Props) => {
    renderResult.rerender(
      <TestProvider grafanaContext={context}>
        <LocationServiceProvider service={locationService}>
          <DashboardScenePage {...newProps} />
        </LocationServiceProvider>
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

config.panels['custom-viz-panel'] = panelPlugin.meta;

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
    locationService.push('/d/my-dash-uid');
    getDashboardScenePageStateManager().clearDashboardCache();
    loadDashboardMock.mockClear();
    loadDashboardMock.mockResolvedValue({ dashboard: simpleDashboard, meta: { slug: '123' } });
    // hacky way because mocking autosizer does not work
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });
    getPluginExtensionsMock.mockRestore();
    getPluginExtensionsMock.mockReturnValue({ extensions: [] });
    store.delete(DASHBOARD_FROM_LS_KEY);
  });

  it('Can render dashboard', async () => {
    setup();

    await waitForDashboardToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
    expect(await screen.findByText('Content A')).toBeInTheDocument();

    expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
    expect(await screen.findByText('Content B')).toBeInTheDocument();
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

      expect(await screen.queryByText('Start your new dashboard by adding a visualization')).not.toBeInTheDocument();

      // Hacking a bit, accessing private cache property to get access to the underlying DashboardScene object
      const dashboardScenesCache = getDashboardScenePageStateManager().getCache();
      const dashboard = dashboardScenesCache['my-dash-uid'];
      const panels = dashboardSceneGraph.getVizPanels(dashboard);

      act(() => {
        dashboard.removePanel(panels[0]);
      });
      expect(await screen.queryByText('Start your new dashboard by adding a visualization')).not.toBeInTheDocument();

      act(() => {
        dashboard.removePanel(panels[1]);
      });
      expect(await screen.findByText('Start your new dashboard by adding a visualization')).toBeInTheDocument();

      act(() => {
        dashboard.addPanel(new VizPanel({ title: 'Panel Added', key: 'panel-4', pluginId: 'timeseries' }));
      });

      expect(await screen.findByTitle('Panel Added')).toBeInTheDocument();
      expect(await screen.queryByText('Start your new dashboard by adding a visualization')).not.toBeInTheDocument();
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
      // This test is missing setup for v2 api so it erroring
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const manager = getDashboardScenePageStateManager();
      manager.setActiveManager('v2');

      const { unmount } = setup();

      expect(manager['activeManager']).toBeInstanceOf(DashboardScenePageStateManagerV2);
      unmount();
      expect(manager['activeManager']).toBeInstanceOf(DashboardScenePageStateManager);
    });
  });
});

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
