import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { of } from 'rxjs';
import { render } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, PanelData, PanelProps } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, getPluginLinkExtensions, setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { DashboardRoutes } from 'app/types/dashboard';

import { setupLoadDashboardMock, setupLoadDashboardMockReject } from '../utils/test-utils';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';
import { PublicDashboardScenePage, Props as PublicDashboardSceneProps } from './PublicDashboardScenePage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn(),
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({}),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
}));

const getPluginLinkExtensionsMock = jest.mocked(getPluginLinkExtensions);

function setup(token = 'an-access-token') {
  const pubdashProps: PublicDashboardSceneProps = {
    ...getRouteComponentProps({
      route: {
        routeName: DashboardRoutes.Public,
        path: '/public-dashboards/:accessToken',
        component: () => null,
      },
    }),
  };

  return render(
    <Routes>
      <Route path="/public-dashboards/:accessToken" element={<PublicDashboardScenePage {...pubdashProps} />} />
    </Routes>,
    { historyOptions: { initialEntries: [`/public-dashboards/${token}`] } }
  );
}

const simpleDashboard: Dashboard = {
  title: 'My cool dashboard',
  uid: 'my-dash-uid',
  schemaVersion: 30,
  version: 1,
  timepicker: { hidden: false },
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

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
    annotations: [],
  })
);
setRunRequest(runRequestMock);

const componentsSelector = e2eSelectors.components;
const publicDashboardSelector = e2eSelectors.pages.PublicDashboard;
const publicDashboardSceneSelector = e2eSelectors.pages.PublicDashboardScene;

describe('PublicDashboardScenePage', () => {
  beforeEach(() => {
    config.publicDashboardAccessToken = 'an-access-token';
    getDashboardScenePageStateManager().clearDashboardCache();
    setupLoadDashboardMock({ dashboard: simpleDashboard, meta: {} });

    // // hacky way because mocking autosizer does not work
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });
    getPluginLinkExtensionsMock.mockRestore();
    getPluginLinkExtensionsMock.mockReturnValue({ extensions: [] });
  });

  it('can render public dashboard', async () => {
    setup();

    await waitForDashboardGridToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
    expect(await screen.findByText('Content A')).toBeInTheDocument();

    expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
    expect(await screen.findByText('Content B')).toBeInTheDocument();

    expect(await screen.findByTestId(publicDashboardSelector.footer)).toBeInTheDocument();
  });

  it('cannot see menu panel', async () => {
    setup();

    await waitForDashboardGridToRender();

    expect(screen.queryByTestId(componentsSelector.Panels.Panel.menu('Panel A'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(componentsSelector.Panels.Panel.menu('Panel B'))).not.toBeInTheDocument();
  });

  it('shows time controls when it is not hidden', async () => {
    setup();

    await waitForDashboardGridToRender();

    expect(screen.queryByTestId(componentsSelector.TimePicker.openButton)).toBeInTheDocument();
    expect(screen.queryByTestId(componentsSelector.RefreshPicker.runButtonV2)).toBeInTheDocument();
    expect(screen.queryByTestId(componentsSelector.RefreshPicker.intervalButtonV2)).toBeInTheDocument();
  });

  it('does not render paused or deleted screen', async () => {
    setup();

    await waitForDashboardGridToRender();

    expect(screen.queryByTestId(publicDashboardSelector.NotAvailable.container)).not.toBeInTheDocument();
  });

  it('does not show time controls when it is hidden', async () => {
    const accessToken = 'hidden-time-picker-pubdash-access-token';
    config.publicDashboardAccessToken = accessToken;
    setupLoadDashboardMock({
      dashboard: { ...simpleDashboard, timepicker: { hidden: true } },
      meta: {},
    });
    setup(accessToken);

    await waitForDashboardGridToRender();

    expect(screen.queryByTestId(componentsSelector.TimePicker.openButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(componentsSelector.RefreshPicker.runButtonV2)).not.toBeInTheDocument();
    expect(screen.queryByTestId(componentsSelector.RefreshPicker.intervalButtonV2)).not.toBeInTheDocument();
  });
});

describe('given unavailable public dashboard', () => {
  it('renders public dashboard paused screen when it is paused', async () => {
    const accessToken = 'paused-pubdash-access-token';
    config.publicDashboardAccessToken = accessToken;

    setupLoadDashboardMockReject({
      status: 403,
      statusText: 'Forbidden',
      data: {
        statusCode: 403,
        messageId: 'publicdashboards.notEnabled',
        message: 'Dashboard paused',
      },
      config: {
        method: 'GET',
        url: 'api/public/dashboards/ce159fe139fc4d238a7d9c3ae33fb82b',
        retry: 0,
        headers: {
          'X-Grafana-Org-Id': 1,
          'X-Grafana-Device-Id': 'da48fad0e58ba327fd7d1e6bd17e9c63',
        },
        hideFromInspector: true,
      },
    });

    setup(accessToken);

    await waitForElementToBeRemoved(screen.getByTestId(publicDashboardSceneSelector.loadingPage));

    expect(screen.queryByTestId(publicDashboardSceneSelector.page)).not.toBeInTheDocument();
    expect(screen.getByTestId(publicDashboardSelector.NotAvailable.title)).toBeInTheDocument();
    expect(screen.getByTestId(publicDashboardSelector.NotAvailable.pausedDescription)).toBeInTheDocument();
  });

  it('renders public dashboard not available screen when it is deleted', async () => {
    const accessToken = 'deleted-pubdash-access-token';
    config.publicDashboardAccessToken = accessToken;

    setupLoadDashboardMockReject({
      status: 404,
      statusText: 'Not Found',
      data: {
        statusCode: 404,
        messageId: 'publicdashboards.notFound',
        message: 'Dashboard not found',
      },
      config: {
        method: 'GET',
        url: 'api/public/dashboards/ce159fe139fc4d238a7d9c3ae33fb82b',
        retry: 0,
        hideFromInspector: true,
        headers: {
          'X-Grafana-Device-Id': 'da48fad0e58ba327fd7d1e6bd17e9c63',
        },
      },
    });

    setup(accessToken);

    await waitForElementToBeRemoved(screen.getByTestId(publicDashboardSceneSelector.loadingPage));

    expect(screen.queryByTestId(publicDashboardSelector.page)).not.toBeInTheDocument();
    expect(screen.queryByTestId(publicDashboardSelector.NotAvailable.pausedDescription)).not.toBeInTheDocument();
    expect(screen.getByTestId(publicDashboardSelector.NotAvailable.title)).toBeInTheDocument();
  });
});

interface VizOptions {
  content: string;
}
interface VizProps extends PanelProps<VizOptions> {}

function CustomVizPanel(props: VizProps) {
  return <div>{props.options.content}</div>;
}

async function waitForDashboardGridToRender() {
  expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
  expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
}
