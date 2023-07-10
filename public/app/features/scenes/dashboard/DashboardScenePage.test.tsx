import { render, screen } from '@testing-library/react';
import React from 'react';
import { AutoSizerProps } from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { PanelProps } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';

import { DashboardScenePage, Props } from './DashboardScenePage';

// Mocking AutoSizer to allow testing of the SceneGridLayout component rendering
// Does not work
jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: AutoSizerProps) => children({ height: 1000, width: 1000 });
});

// Does not work
jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [() => {}, { width: 100, height: 100 }],
}));

function setup() {
  const context = getGrafanaContextMock();
  const props: Props = {
    ...getRouteComponentProps(),
  };
  props.match.params.uid = 'd10';

  const renderResult = render(
    <TestProvider grafanaContext={context}>
      <DashboardScenePage {...props} />
    </TestProvider>
  );

  return { renderResult, context };
}

const simpleDashboard = {
  title: 'My cool dashboard',
  uid: '10d',
  panels: [
    {
      type: 'custom-viz-panel',
      title: 'Text panel title',
      content: `Text panel says hello`,
      gridPos: {
        x: 0,
        y: 0,
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

let listener: ((rect: any) => void) | undefined = undefined;

describe('DashboardScenePage', () => {
  beforeAll(() => {
    // hacky way because mocking autosizer does not work
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });
  });

  it('Can render dashboard', async () => {
    (global.window as any).ResizeObserver = class ResizeObserver {
      constructor(ls: (rect: any) => void) {
        listener = ls;
      }
      observe() {}
      disconnect() {}
    };

    const loadDashboardMock = jest.fn().mockResolvedValue({ dashboard: simpleDashboard, meta: {} });
    setDashboardLoaderSrv({
      loadDashboard: loadDashboardMock,
    } as unknown as DashboardLoaderSrv);

    setup();

    expect(loadDashboardMock.mock.calls.length).toBe(1);

    expect(await screen.findByText('Last 6 hours')).toBeInTheDocument();
    expect(await screen.findByText('Text panel title')).toBeInTheDocument();
  });
});

interface VizOptions {
  content: string;
}
interface VizProps extends PanelProps<VizOptions> {}

function CustomVizPanel(props: VizProps) {
  return <div>{props.options.content}</div>;
}
