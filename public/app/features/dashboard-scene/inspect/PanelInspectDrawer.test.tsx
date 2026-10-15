import { waitFor } from '@testing-library/react';

import { CoreApp, DataSourceApi, getDefaultTimeRange, LoadingState, PanelPlugin, toDataFrame } from '@grafana/data';
import { getDataSourceInstance, setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, VizPanel } from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { PanelInspectDrawer } from './PanelInspectDrawer';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstance: jest.fn(),
}));

class InspectorDatasource extends DataSourceApi {
  query = jest.fn();
  testDatasource = jest.fn();
  components = { MetadataInspector: () => null, ErrorsAndNoticesInspector: () => null };
}

function datasource(uid: string) {
  return new InspectorDatasource({
    id: 1,
    uid,
    name: uid,
    type: 'test',
    access: 'proxy',
    readOnly: false,
    jsonData: {},
    meta: {} as DataSourceApi['meta'],
  });
}

const plugin = new PanelPlugin(() => null);
setPluginImportUtils({ getPanelPluginFromCache: () => plugin, importPanelPlugin: async () => plugin });

beforeEach(() => {
  jest.mocked(getDataSourceInstance).mockReset();
  plugin.meta.skipDataQuery = false;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function setup() {
  const data = new SceneDataNode({
    data: {
      series: [],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      request: {
        requestId: 'request',
        interval: '1s',
        intervalMs: 1000,
        range: getDefaultTimeRange(),
        targets: [{ refId: 'A', datasource: { uid: 'first' } }],
        scopedVars: {},
        startTime: 0,
        timezone: 'utc',
        app: CoreApp.Dashboard,
      },
    },
  });
  const panel = new VizPanel({ $data: data });
  jest.spyOn(panel, 'getPlugin').mockReturnValue(plugin);
  const drawer = new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.Data });
  new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]), overlay: drawer });
  return { data, panel, drawer, tabs: () => drawer.state.tabs?.map((tab) => tab.getTabValue()) };
}

it('adds Meta data when query results arrive after inspector opens', async () => {
  jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
  const { data, drawer, tabs } = setup();
  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));

  data.setState({
    data: { ...data.state.data!, series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })] },
  });

  await waitFor(() =>
    expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.Meta, InspectTab.JSON])
  );
  deactivate();
});

it('shows and removes Errors and notices as query results change', async () => {
  jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
  const { data, drawer, tabs } = setup();
  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));

  data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });
  await waitFor(() =>
    expect(tabs()).toEqual([
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ])
  );
  data.setState({ data: { ...data.state.data!, errors: [] } });
  await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));
  deactivate();
});

it('ignores stale datasource discovery after the data provider changes', async () => {
  const first = datasource('first');
  const second = datasource('second');
  let resolveFirst!: (value: DataSourceApi) => void;
  const pending = new Promise<DataSourceApi>((resolve) => {
    resolveFirst = resolve;
  });
  jest
    .mocked(getDataSourceInstance)
    .mockImplementation(async (ref) => (typeof ref === 'object' && ref?.uid === 'second' ? second : pending));
  const { data, panel, drawer, tabs } = setup();
  data.setState({ data: { ...data.state.data!, series: [toDataFrame({ fields: [], meta: { custom: {} } })] } });
  const deactivate = drawer.activate();
  const replacement = new SceneDataNode({
    data: {
      ...data.state.data!,
      request: { ...data.state.data!.request!, targets: [{ refId: 'A', datasource: { uid: 'second' } }] },
    },
  });
  panel.setState({ $data: replacement });
  await waitFor(() => expect(tabs()).toContain(InspectTab.Meta));
  const latest = drawer.state.tabs;
  resolveFirst(first);
  await pending;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(drawer.state.tabs).toBe(latest);
  deactivate();
});
