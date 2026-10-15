import { waitFor } from '@testing-library/react';

import { CoreApp, DataSourceApi, getDefaultTimeRange, LoadingState, PanelPlugin, toDataFrame } from '@grafana/data';
import { PanelStatusStore } from '@grafana/data/internal';
import { getDataSourceInstance, setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, VizPanel } from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { InspectErrorsAndNoticesTab } from './InspectErrorsAndNoticesTab';
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

beforeEach(() => {
  jest.mocked(getDataSourceInstance).mockReset();
  plugin.meta.skipDataQuery = false;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const plugin = new PanelPlugin(() => null);
setPluginImportUtils({ getPanelPluginFromCache: () => plugin, importPanelPlugin: async () => plugin });

function setup() {
  const store = new PanelStatusStore();
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
  const panel = new VizPanel({
    $data: data,
    extendPanelContext: (_, context) => {
      context.notices = store;
    },
  });
  jest.spyOn(panel, 'getPlugin').mockReturnValue(plugin);
  const drawer = new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.ErrorsAndNotices });
  new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]), overlay: drawer });
  return { store, data, panel, drawer, tabs: () => drawer.state.tabs?.map((tab) => tab.getTabValue()) };
}

it('shows only JSON for an empty panel and reacts to notices appearing and clearing', async () => {
  plugin.meta.skipDataQuery = true;
  const { store, drawer, tabs } = setup();
  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
  const source = store.createSource();
  source.set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);
  await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
  const noticeTab = drawer.state.tabs![0];
  source.set([{ id: 'panel', severity: 'warning', text: 'Updated notice' }]);
  await waitFor(() => expect(drawer.state.tabs![0]).toBe(noticeTab));
  source.set([]);
  await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
  deactivate();
  source.set([{ id: 'late', severity: 'info', text: 'Late notice' }]);
  expect(tabs()).toEqual([InspectTab.JSON]);
});

it('uses query and plugin-load fallback but respects an initialized empty snapshot', async () => {
  plugin.meta.skipDataQuery = true;
  const { store, drawer, tabs, data, panel } = setup();
  data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });
  const deactivate = drawer.activate();
  expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]);
  store.setExternal([]);
  expect(tabs()).toEqual([InspectTab.JSON]);
  store.clear();
  data.setState({ data: { ...data.state.data!, errors: [] } });
  panel.setState({ _pluginLoadError: 'Plugin failed' });
  expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]);
  deactivate();
});

function withQueryData() {
  plugin.meta.skipDataQuery = false;
  const result = setup();
  result.data.setState({
    data: {
      ...result.data.state.data!,
      series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })],
      errors: [{ message: 'Query failed' }],
    },
  });
  return result;
}

it('shows all applicable tabs when query data is already loaded', async () => {
  jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
  const { data, drawer, tabs } = setup();
  data.setState({
    data: {
      ...data.state.data!,
      series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })],
      errors: [{ message: 'Query failed' }],
    },
  });

  const deactivate = drawer.activate();
  await waitFor(() =>
    expect(tabs()).toEqual([
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.Meta,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ])
  );
  deactivate();
});

it('shows only JSON for a non-query panel without status', async () => {
  plugin.meta.skipDataQuery = true;
  const { data, drawer, tabs } = setup();
  data.setState({
    data: {
      ...data.state.data!,
      series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })],
    },
  });

  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
  deactivate();
});

it('adds Meta data when query results arrive after inspector opens', async () => {
  jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
  const { data, drawer, tabs } = withQueryData();
  data.setState({ data: { ...data.state.data!, series: [], errors: [] } });
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
  const { data, drawer, tabs } = withQueryData();
  data.setState({ data: { ...data.state.data!, series: [], errors: [] } });
  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));

  data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });
  await waitFor(() => expect(tabs()).toContain(InspectTab.ErrorsAndNotices));
  data.setState({ data: { ...data.state.data!, errors: [] } });
  await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));
  deactivate();
});

it('preserves tabs and skips datasource discovery when notices or actions change', async () => {
  jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
  const { drawer, store, tabs } = withQueryData();
  const deactivate = drawer.activate();
  await waitFor(() =>
    expect(tabs()).toEqual([
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.Meta,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ])
  );
  const original = drawer.state.tabs;
  const calls = jest.mocked(getDataSourceInstance).mock.calls.length;
  const source = store.createSource();
  source.set([{ id: 'notice', severity: 'warning', text: 'Warning' }]);
  source.set([
    {
      id: 'notice',
      severity: 'warning',
      text: 'Warning',
      actions: [{ id: 'retry', label: 'Retry', onClick: jest.fn() }],
    },
  ]);
  await Promise.resolve();
  expect(drawer.state.tabs).toBe(original);
  expect(getDataSourceInstance).toHaveBeenCalledTimes(calls);
  deactivate();
});

it('ignores stale discovery after provider replacement and preserves unrelated tabs', async () => {
  const first = datasource('first');
  const second = datasource('second');
  let resolveFirst!: (value: DataSourceApi) => void;
  const pending = new Promise<DataSourceApi>((resolve) => {
    resolveFirst = resolve;
  });
  jest
    .mocked(getDataSourceInstance)
    .mockImplementation(async (ref) => (typeof ref === 'object' && ref?.uid === 'second' ? second : pending));
  const { drawer, data, panel, tabs } = withQueryData();
  const deactivate = drawer.activate();
  const dataTab = drawer.state.tabs![0];
  const replacement = new SceneDataNode({
    data: {
      ...data.state.data!,
      request: { ...data.state.data!.request!, targets: [{ refId: 'A', datasource: { uid: 'second' } }] },
    },
  });
  panel.setState({ $data: replacement });
  await waitFor(() =>
    expect(drawer.state.tabs?.find((tab) => tab instanceof InspectErrorsAndNoticesTab)?.state).toMatchObject({
      dataSource: second,
    })
  );
  const latest = drawer.state.tabs;
  resolveFirst(first);
  await pending;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(drawer.state.tabs).toBe(latest);
  expect(drawer.state.tabs![0]).toBe(dataTab);
  data.setState({ data: { ...data.state.data!, errors: [] } });
  expect(tabs()).toContain(InspectTab.ErrorsAndNotices);
  deactivate();
});

it('keeps standard notices available when datasource discovery fails', async () => {
  jest.mocked(getDataSourceInstance).mockRejectedValue(new Error('Unavailable'));
  const { drawer, tabs } = withQueryData();
  const deactivate = drawer.activate();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(tabs()).toEqual([
    InspectTab.Data,
    InspectTab.Stats,
    InspectTab.Query,
    InspectTab.ErrorsAndNotices,
    InspectTab.JSON,
  ]);
  expect(drawer.state.tabs?.find((tab) => tab instanceof InspectErrorsAndNoticesTab)?.state.dataSource).toBeUndefined();
  deactivate();
});

it('does not extend plugin timeout on notice updates and cancels polling on close', () => {
  jest.useFakeTimers();
  const { drawer, panel, store } = setup();
  jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
  const deactivate = drawer.activate();
  jest.advanceTimersByTime(1900);
  store.createSource().set([{ id: 'notice', text: 'Warning', severity: 'warning' }]);
  jest.advanceTimersByTime(100);
  expect(drawer.state.pluginNotLoaded).toBe(true);
  panel.setState({ pluginId: 'another' });
  expect(drawer.state.pluginNotLoaded).toBe(false);
  deactivate();
  jest.advanceTimersByTime(2000);
  expect(drawer.state.pluginNotLoaded).toBe(false);
});

it('preserves active tab and tab instances across equivalent data and provider changes', async () => {
  jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
  const { data, panel, drawer, tabs } = setup();
  data.setState({
    data: { ...data.state.data!, series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })] },
  });
  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toContain(InspectTab.Meta));
  drawer.setState({ currentTab: InspectTab.Query });
  const original = drawer.state.tabs;

  data.setState({ data: { ...data.state.data! } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(drawer.state.tabs).toBe(original);

  panel.setState({ $data: new SceneDataNode({ data: data.state.data }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(drawer.state.tabs).toBe(original);
  expect(drawer.state.currentTab).toBe(InspectTab.Query);
  deactivate();
});

it('ignores datasource discovery that finishes after the drawer closes', async () => {
  let resolve!: (value: DataSourceApi) => void;
  const pending = new Promise<DataSourceApi>((done) => {
    resolve = done;
  });
  jest.mocked(getDataSourceInstance).mockReturnValue(pending);
  const { data, drawer, tabs } = setup();
  data.setState({
    data: { ...data.state.data!, series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })] },
  });
  const deactivate = drawer.activate();
  expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]);
  const original = drawer.state.tabs;

  deactivate();
  resolve(datasource('first'));
  await pending;
  await new Promise((done) => setTimeout(done, 0));

  expect(drawer.state.tabs).toBe(original);
});

it('adds query tabs when a panel plugin becomes available during retry', () => {
  jest.useFakeTimers();
  const { panel, drawer, tabs } = setup();
  const getPlugin = jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
  const deactivate = drawer.activate();
  expect(tabs()).toEqual([InspectTab.JSON]);

  getPlugin.mockReturnValue(plugin);
  jest.advanceTimersByTime(100);

  expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]);
  expect(drawer.state.pluginNotLoaded).toBe(false);
  deactivate();
});

it('shows plugin load failure after the timeout and clears it on plugin replacement', () => {
  jest.useFakeTimers();
  const { panel, drawer, tabs } = setup();
  const getPlugin = jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
  const deactivate = drawer.activate();
  expect(tabs()).toEqual([InspectTab.JSON]);

  jest.advanceTimersByTime(2000);
  expect(drawer.state.pluginNotLoaded).toBe(true);
  getPlugin.mockReturnValue(plugin);
  panel.setState({ pluginId: 'loaded' });

  expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]);
  expect(drawer.state.pluginNotLoaded).toBe(false);
  deactivate();
});
