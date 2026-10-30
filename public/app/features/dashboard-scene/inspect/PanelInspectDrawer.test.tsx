import { waitFor } from '@testing-library/react';

import { CoreApp, DataSourceApi, getDefaultTimeRange, LoadingState, PanelPlugin, toDataFrame } from '@grafana/data';
import { getPanelDataStatusItems, PanelStatusStore } from '@grafana/data/internal';
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

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const plugin = new PanelPlugin(() => null);
setPluginImportUtils({ getPanelPluginFromCache: () => plugin, importPanelPlugin: async () => plugin });

function activateDrawer(drawer: PanelInspectDrawer) {
  const deactivate = drawer.activate();
  let active = true;
  const cleanup = () => {
    if (active) {
      active = false;
      deactivate();
    }
  };
  cleanups.push(cleanup);
  return cleanup;
}

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

describe('Tab availability', () => {
  it('shows an existing panel notice on a non-query panel', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs } = setup();
    store.createSource().set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);

    const deactivate = activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
    expect(drawer.state.tabs?.[0]).toBeInstanceOf(InspectErrorsAndNoticesTab);
    deactivate();
  });

  it('adds Errors and notices when a panel notice appears after opening', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs } = setup();
    activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));

    store.createSource().set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);

    await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
  });

  it('removes Errors and notices when panel notices clear', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs } = setup();
    const source = store.createSource();
    source.set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);
    activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));

    source.set([]);

    await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
  });

  it('preserves the notices tab when a panel notice changes', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs } = setup();
    const source = store.createSource();
    source.set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);
    activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
    const noticeTab = drawer.state.tabs![0];

    source.set([{ id: 'panel', severity: 'warning', text: 'Updated notice' }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(drawer.state.tabs![0]).toBe(noticeTab);
  });

  it('does not publish panel notices after the drawer closes', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs } = setup();
    const deactivate = activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
    deactivate();

    store.createSource().set([{ id: 'late', severity: 'info', text: 'Late notice' }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tabs()).toEqual([InspectTab.JSON]);
  });

  it('respects an initially empty host snapshot despite query and plugin errors', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs, data, panel } = setup();
    data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });
    panel.setState({ _pluginLoadError: 'Plugin failed' });
    store.setExternal([]);

    activateDrawer(drawer);

    await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
  });

  it('removes fallback query errors when the host initializes an empty snapshot', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs, data } = setup();
    data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });
    activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));

    store.setExternal([]);

    await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
  });

  it('uses plugin-load fallback after the host snapshot is cleared', async () => {
    plugin.meta.skipDataQuery = true;
    const { store, drawer, tabs, panel } = setup();
    store.setExternal([]);
    activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));

    store.clear();
    panel.setState({ _pluginLoadError: 'Plugin failed' });

    await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
  });

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

    const deactivate = activateDrawer(drawer);
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

    const deactivate = activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));
    deactivate();
  });

  it('adds Meta data when query results arrive after inspector opens', async () => {
    jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
    const { data, drawer, tabs } = withQueryData();
    data.setState({ data: { ...data.state.data!, series: [], errors: [] } });
    const deactivate = activateDrawer(drawer);
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
    const deactivate = activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));

    data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });
    await waitFor(() => expect(tabs()).toContain(InspectTab.ErrorsAndNotices));
    data.setState({ data: { ...data.state.data!, errors: [] } });
    await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));
    deactivate();
  });

  it('keeps standard notices available when datasource discovery fails', async () => {
    jest.mocked(getDataSourceInstance).mockRejectedValue(new Error('Unavailable'));
    const { drawer, tabs } = withQueryData();
    activateDrawer(drawer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tabs()).toEqual([
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ]);
    expect(
      drawer.state.tabs?.find((tab) => tab instanceof InspectErrorsAndNoticesTab)?.state.dataSource
    ).toBeUndefined();
  });
});

describe('Loading and selection', () => {
  it('keeps result tabs visible while a refresh is loading', async () => {
    jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
    const { store, data, drawer, tabs } = withQueryData();
    store.setExternal(getPanelDataStatusItems(data.state.data));
    const deactivate = activateDrawer(drawer);
    const loadedTabs = [
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.Meta,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ];
    await waitFor(() => expect(tabs()).toEqual(loadedTabs));
    const original = drawer.state.tabs;

    data.setState({ data: { ...data.state.data!, state: LoadingState.Loading, series: [], errors: [] } });
    store.setExternal([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tabs()).toEqual(loadedTabs);
    expect(drawer.state.tabs).toBe(original);

    deactivate();
  });

  it('removes result tabs when a refresh finishes without metadata or errors', async () => {
    jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
    const { store, data, drawer, tabs } = withQueryData();
    store.setExternal(getPanelDataStatusItems(data.state.data));
    const deactivate = activateDrawer(drawer);
    const loadedTabs = [
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.Meta,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ];
    await waitFor(() => expect(tabs()).toEqual(loadedTabs));

    data.setState({ data: { ...data.state.data!, state: LoadingState.Loading, series: [], errors: [] } });
    store.setExternal([]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    data.setState({ data: { ...data.state.data!, state: LoadingState.Done } });
    await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));
    deactivate();
  });

  it('selects a remaining tab when the active result tab disappears', async () => {
    jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
    const { data, drawer, tabs } = withQueryData();
    const deactivate = activateDrawer(drawer);
    await waitFor(() => expect(tabs()).toContain(InspectTab.ErrorsAndNotices));
    drawer.setState({ currentTab: InspectTab.ErrorsAndNotices });

    data.setState({ data: { ...data.state.data!, series: [], errors: [] } });
    await waitFor(() => expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]));
    expect(drawer.state.currentTab).toBe(InspectTab.Data);

    data.setState({ data: { ...data.state.data!, errors: [{ message: 'New error' }] } });
    await waitFor(() => expect(tabs()).toContain(InspectTab.ErrorsAndNotices));
    expect(drawer.state.currentTab).toBe(InspectTab.Data);
    deactivate();
  });

  it('keeps a requested tab selected while datasource discovery is pending', async () => {
    jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
    const { data, drawer, tabs } = setup();
    data.setState({
      data: { ...data.state.data!, series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })] },
    });
    drawer.setState({ currentTab: InspectTab.Meta });

    const deactivate = activateDrawer(drawer);
    expect(drawer.state.currentTab).toBe(InspectTab.Meta);
    await waitFor(() => expect(tabs()).toContain(InspectTab.Meta));
    expect(drawer.state.currentTab).toBe(InspectTab.Meta);
    deactivate();
  });
});

describe('Tab identity and discovery lifecycle', () => {
  it('preserves tabs and skips datasource discovery when notices or actions change', async () => {
    jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
    const { drawer, store, tabs } = withQueryData();
    const deactivate = activateDrawer(drawer);
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

  it('ignores stale discovery after provider replacement', async () => {
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
    const deactivate = activateDrawer(drawer);
    await waitFor(() => expect(getDataSourceInstance).toHaveBeenCalled());
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
    data.setState({ data: { ...data.state.data!, errors: [] } });
    expect(tabs()).toContain(InspectTab.ErrorsAndNotices);
    deactivate();
  });

  it('preserves the Data tab when a replacement provider discovers a different datasource', async () => {
    const first = datasource('first');
    const second = datasource('second');
    jest
      .mocked(getDataSourceInstance)
      .mockImplementation(async (ref) => (typeof ref === 'object' && ref?.uid === 'second' ? second : first));
    const { drawer, data, panel, tabs } = withQueryData();
    activateDrawer(drawer);
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
    const dataTab = drawer.state.tabs![0];

    panel.setState({
      $data: new SceneDataNode({
        data: {
          ...data.state.data!,
          request: { ...data.state.data!.request!, targets: [{ refId: 'A', datasource: { uid: 'second' } }] },
        },
      }),
    });
    await waitFor(() =>
      expect(drawer.state.tabs?.find((tab) => tab instanceof InspectErrorsAndNoticesTab)?.state.dataSource).toBe(second)
    );

    expect(drawer.state.tabs![0]).toBe(dataTab);
  });

  it('preserves active tab and tab instances across equivalent data and provider changes', async () => {
    jest.mocked(getDataSourceInstance).mockResolvedValue(datasource('first'));
    const { data, panel, drawer, tabs } = setup();
    data.setState({
      data: { ...data.state.data!, series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })] },
    });
    const deactivate = activateDrawer(drawer);
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
    const { data, drawer } = setup();
    data.setState({
      data: { ...data.state.data!, series: [toDataFrame({ fields: [], meta: { custom: { detail: true } } })] },
    });
    const deactivate = activateDrawer(drawer);
    await waitFor(() => expect(getDataSourceInstance).toHaveBeenCalled());
    const original = drawer.state.tabs;

    deactivate();
    resolve(datasource('first'));
    await pending;
    await new Promise((done) => setTimeout(done, 0));

    expect(drawer.state.tabs).toBe(original);
  });
});

describe('Plugin availability', () => {
  it('does not extend plugin timeout on notice updates', () => {
    jest.useFakeTimers();
    const { drawer, panel, store } = setup();
    jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
    activateDrawer(drawer);
    jest.advanceTimersByTime(1900);
    store.createSource().set([{ id: 'notice', text: 'Warning', severity: 'warning' }]);

    jest.advanceTimersByTime(100);

    expect(drawer.state.pluginNotLoaded).toBe(true);
  });

  it('cancels plugin polling when the drawer closes', () => {
    jest.useFakeTimers();
    const { drawer, panel, tabs } = setup();
    const getPlugin = jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
    const deactivate = activateDrawer(drawer);
    expect(tabs()).toEqual([InspectTab.JSON]);
    jest.advanceTimersByTime(100);
    deactivate();
    getPlugin.mockClear();

    jest.advanceTimersByTime(2000);

    expect(getPlugin).not.toHaveBeenCalled();
    expect(drawer.state.pluginNotLoaded).not.toBe(true);
  });

  it('restarts the plugin timeout when an unavailable plugin is replaced', () => {
    jest.useFakeTimers();
    const { drawer, panel } = setup();
    jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
    activateDrawer(drawer);
    jest.advanceTimersByTime(2000);
    expect(drawer.state.pluginNotLoaded).toBe(true);

    panel.setState({ pluginId: 'another' });

    expect(drawer.state.pluginNotLoaded).toBe(false);
    jest.advanceTimersByTime(1900);
    expect(drawer.state.pluginNotLoaded).toBe(false);
    jest.advanceTimersByTime(100);
    expect(drawer.state.pluginNotLoaded).toBe(true);
  });

  it('adds query tabs when a panel plugin becomes available during retry', async () => {
    jest.useFakeTimers();
    const { panel, drawer, tabs } = setup();
    const getPlugin = jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
    const deactivate = activateDrawer(drawer);
    expect(tabs()).toEqual([InspectTab.JSON]);

    getPlugin.mockReturnValue(plugin);
    await jest.advanceTimersByTimeAsync(100);

    expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]);
    expect(drawer.state.pluginNotLoaded).not.toBe(true);
    deactivate();
  });

  it('shows plugin load failure after the timeout and clears it on plugin replacement', async () => {
    jest.useFakeTimers();
    const { panel, drawer, tabs } = setup();
    const getPlugin = jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
    const deactivate = activateDrawer(drawer);
    expect(tabs()).toEqual([InspectTab.JSON]);

    jest.advanceTimersByTime(2000);
    expect(drawer.state.pluginNotLoaded).toBe(true);
    getPlugin.mockReturnValue(plugin);
    panel.setState({ pluginId: 'loaded' });
    await jest.advanceTimersByTimeAsync(100);

    expect(tabs()).toEqual([InspectTab.Data, InspectTab.Stats, InspectTab.Query, InspectTab.JSON]);
    expect(drawer.state.pluginNotLoaded).toBe(false);
    deactivate();
  });
});

it('retains the initial query-error tab', async () => {
  plugin.meta.skipDataQuery = false;
  const { data, drawer, tabs } = setup();
  data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });

  const deactivate = activateDrawer(drawer);
  await waitFor(() =>
    expect(tabs()).toEqual([
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ])
  );
  deactivate();
});

it('shows an initial plugin-load error on a non-query panel', async () => {
  plugin.meta.skipDataQuery = true;
  const { panel, drawer, tabs } = setup();
  panel.setState({ _pluginLoadError: 'Plugin failed' });

  const deactivate = activateDrawer(drawer);
  await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
  deactivate();
});
