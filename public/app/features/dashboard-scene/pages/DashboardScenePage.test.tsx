import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep } from 'lodash';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { PanelProps } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, getPluginLinkExtensions, locationService, setPluginImportUtils } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';

import { DashboardScenePage, Props } from './DashboardScenePage';
import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

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

function setup() {
  const context = getGrafanaContextMock();
  const props: Props = {
    ...getRouteComponentProps(),
  };
  props.match.params.uid = 'my-dash-uid';

  const renderResult = render(
    <TestProvider grafanaContext={context}>
      <DashboardScenePage {...props} />
    </TestProvider>
  );

  const rerender = (newProps: Props) => {
    renderResult.rerender(
      <TestProvider grafanaContext={context}>
        <DashboardScenePage {...newProps} />
      </TestProvider>
    );
  };

  return { rerender, context, props };
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
    locationService.push('/');
    getDashboardScenePageStateManager().clearDashboardCache();
    loadDashboardMock.mockClear();
    loadDashboardMock.mockResolvedValue({ dashboard: simpleDashboard, meta: {} });
    // hacky way because mocking autosizer does not work
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });
    getPluginLinkExtensionsMock.mockRestore();
    getPluginLinkExtensionsMock.mockReturnValue({ extensions: [] });
  });

  it('Can render dashboard', async () => {
    setup();

    await waitForDashbordToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
    expect(await screen.findByText('Content A')).toBeInTheDocument();

    expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
    expect(await screen.findByText('Content B')).toBeInTheDocument();
  });

  it('routeReloadCounter should trigger reload', async () => {
    const { rerender, props } = setup();

    await waitForDashbordToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();

    const updatedDashboard = cloneDeep(simpleDashboard);
    updatedDashboard.version = 11;
    updatedDashboard.panels![0].title = 'Updated title';

    getDashboardScenePageStateManager().clearDashboardCache();
    loadDashboardMock.mockResolvedValue({ dashboard: updatedDashboard, meta: {} });

    props.history.location.state = { routeReloadCounter: 1 };

    rerender(props);

    expect(await screen.findByTitle('Updated title')).toBeInTheDocument();
  });

  it('Can inspect panel', async () => {
    setup();

    await waitForDashbordToRender();

    expect(screen.queryByText('Inspect: Panel B')).not.toBeInTheDocument();

    // Wish I could use the menu here but unable t get it to open when I click the menu button
    // Somethig with Dropdown that is not working inside react-testing
    await userEvent.click(screen.getByLabelText('Menu for panel with title Panel B'));

    const inspectMenuItem = await screen.findAllByText('Inspect');

    act(() => fireEvent.click(inspectMenuItem[0]));

    expect(await screen.findByText('Inspect: Panel B')).toBeInTheDocument();

    act(() => locationService.partial({ inspect: null }));

    expect(screen.queryByText('Inspect: Panel B')).not.toBeInTheDocument();
  });

  it('Can view panel in fullscreen', async () => {
    setup();

    await waitForDashbordToRender();

    expect(await screen.findByTitle('Panel A')).toBeInTheDocument();

    act(() => locationService.partial({ viewPanel: '2' }));

    expect(screen.queryByTitle('Panel A')).not.toBeInTheDocument();
    expect(await screen.findByTitle('Panel B')).toBeInTheDocument();
  });

  it('Shows empty state when dashboard is empty', async () => {
    loadDashboardMock.mockResolvedValue({ dashboard: { panels: [] }, meta: {} });
    setup();

    expect(await screen.findByText('Start your new dashboard by adding a visualization')).toBeInTheDocument();
  });
});

interface VizOptions {
  content: string;
}
interface VizProps extends PanelProps<VizOptions> {}

function CustomVizPanel(props: VizProps) {
  return <div>{props.options.content}</div>;
}

async function waitForDashbordToRender() {
  expect(await screen.findByText('Last 6 hours')).toBeInTheDocument();
  expect(await screen.findByTitle('Panel A')).toBeInTheDocument();
}
