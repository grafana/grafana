import {
  CoreApp,
  DataSourceApi,
  EventBusSrv,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type PanelStatusItem,
} from '@grafana/data';
import { getTemplateSrv, setTemplateSrv } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { SceneDataNode, VizPanel } from '@grafana/scenes';
import type { PanelContext } from '@grafana/ui';

import { initTemplateSrv } from '../../../../test/helpers/initTemplateSrv';

import { setupPanelNotices } from './setupPanelNotices';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

function response(message: string): PanelData {
  return {
    state: LoadingState.Error,
    series: [],
    timeRange: getDefaultTimeRange(),
    errors: [{ refId: 'A', message }],
    request: {
      requestId: 'request',
      interval: '1s',
      intervalMs: 1000,
      range: getDefaultTimeRange(),
      targets: [{ refId: 'A', datasource: { uid: 'metrics' } }],
      scopedVars: {},
      startTime: 0,
      timezone: 'utc',
      app: CoreApp.Dashboard,
    },
  };
}

class ActionDatasource extends DataSourceApi {
  query = jest.fn();
  testDatasource = jest.fn();
  getPanelStatusActions = jest.fn((statusItem: Readonly<PanelStatusItem>) => ({
    actions: [{ id: 'retry', label: `Retry ${statusItem.text}`, onClick: jest.fn() }],
  }));
}

function setup() {
  const data = new SceneDataNode({ data: response('First error') });
  const panel = new VizPanel({ $data: data, pluginId: 'table' });
  const context: PanelContext = { eventsScope: 'panel', eventBus: new EventBusSrv() };
  setupPanelNotices(panel, context);
  return { data, panel, context, store: context.notices! };
}

it('refreshes external notices without deleting plugin notices and shares surface lifetimes', () => {
  jest.mocked(getDataSourceInstance).mockRejectedValue(new Error('Datasource unavailable'));
  const { data, panel, context, store } = setup();
  const closePopover = context.activateNotices!();
  const closeInspector = context.activateNotices!();
  const source = store.createSource();
  source.set([{ id: 'field', severity: 'warning', text: 'Select field' }]);
  data.setState({ data: response('Second error') });
  expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['Second error', 'Select field']);
  closePopover();
  data.setState({ data: response('Third error') });
  expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['Third error', 'Select field']);
  panel.setState({ pluginId: 'timeseries' });
  expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['Third error']);
  source.set([{ id: 'field', severity: 'warning', text: 'Stale plugin' }]);
  closeInspector();
  expect(store.getSnapshot().items).toEqual([]);
  const closeReopened = context.activateNotices!();
  expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['Third error']);
  closeReopened();
});

it('ignores stale datasource loads and supplies current query context to action resolvers', async () => {
  const datasource = new ActionDatasource({
    id: 1,
    uid: 'metrics',
    type: 'test',
    name: 'Metrics',
    access: 'proxy',
    readOnly: false,
    meta: {} as DataSourceApi['meta'],
    jsonData: {},
  });
  let resolveOld!: (value: DataSourceApi) => void;
  let resolveCurrent!: (value: DataSourceApi) => void;
  jest
    .mocked(getDataSourceInstance)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      })
    )
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCurrent = resolve;
      })
    );
  const { data, context, store } = setup();
  const close = context.activateNotices!();
  const current = response('Current error');
  current.request!.targets[0].datasource = { uid: 'other-metrics' };
  data.setState({ data: current });
  resolveOld(datasource);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(store.getSnapshot().items[0]).toMatchObject({ text: 'Current error', actions: [] });
  resolveCurrent(datasource);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry Current error']);
  expect(datasource.getPanelStatusActions).toHaveBeenCalledWith(
    expect.objectContaining({ text: 'Current error', datasourceUid: 'other-metrics', refId: 'A' }),
    { data: current, query: current.request!.targets[0] }
  );
  const next = response('After variable change');
  next.request!.targets[0].datasource = { uid: 'other-metrics' };
  next.request!.scopedVars = { datasource: { value: 'other-instance' } };
  jest.mocked(getDataSourceInstance).mockResolvedValueOnce(datasource);
  data.setState({ data: next });
  expect(store.getSnapshot().items[0].assistant).toBe('hidden');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(getDataSourceInstance).toHaveBeenLastCalledWith(
    { uid: 'other-metrics' },
    { datasource: { value: 'other-instance' } }
  );
  expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry After variable change']);
  close();
});

it('retains actions and pending datasource loads across equivalent refreshes', async () => {
  const datasource = new ActionDatasource({
    id: 1,
    uid: 'metrics',
    type: 'test',
    name: 'Metrics',
    access: 'proxy',
    readOnly: false,
    meta: {} as DataSourceApi['meta'],
    jsonData: {},
  });
  let resolve!: (value: DataSourceApi) => void;
  jest
    .mocked(getDataSourceInstance)
    .mockClear()
    .mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
  const { data, context, store } = setup();
  const close = context.activateNotices!();
  data.setState({ data: response('While loading') });
  expect(getDataSourceInstance).toHaveBeenCalledTimes(1);
  resolve(datasource);
  await new Promise((done) => setTimeout(done, 0));
  expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry While loading']);
  const current = response('After refresh');
  data.setState({ data: current });
  expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry After refresh']);
  expect(store.getSnapshot().items[0].assistant).not.toBe('hidden');
  expect(getDataSourceInstance).toHaveBeenCalledTimes(1);
  expect(datasource.getPanelStatusActions).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: 'After refresh' }),
    { data: current, query: current.request!.targets[0] }
  );
  close();
});

it('reloads a variable datasource when its value changes with unchanged scoped variables', async () => {
  const previousTemplateSrv = getTemplateSrv();
  const templateSrv = initTemplateSrv('panel-notices', [
    { type: 'datasource', name: 'source', current: { value: 'metrics' } },
  ]);
  setTemplateSrv(templateSrv);
  const datasource = new ActionDatasource({
    id: 1,
    uid: 'metrics',
    type: 'test',
    name: 'Metrics',
    access: 'proxy',
    readOnly: false,
    meta: {} as DataSourceApi['meta'],
    jsonData: {},
  });
  jest.mocked(getDataSourceInstance).mockClear().mockResolvedValue(datasource);
  const { data, context, store } = setup();
  const current = response('Variable error');
  current.request!.targets[0].datasource = { uid: '$source' };
  data.setState({ data: current });
  const close = context.activateNotices!();
  try {
    await new Promise((done) => setTimeout(done, 0));
    expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry Variable error']);
    data.setState({ data: { ...current, request: { ...current.request!, scopedVars: {} } } });
    expect(getDataSourceInstance).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry Variable error']);
    templateSrv.init([{ type: 'datasource', name: 'source', current: { value: 'other-metrics' } }]);
    data.setState({ data: { ...current, request: { ...current.request!, scopedVars: {} } } });
    expect(getDataSourceInstance).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().items[0]).toMatchObject({ assistant: 'hidden', actions: [] });
    await new Promise((done) => setTimeout(done, 0));
    expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry Variable error']);
  } finally {
    close();
    setTemplateSrv(previousTemplateSrv);
  }
});

it('retries a failed datasource load on the next request and ignores loads after deactivation', async () => {
  const datasource = new ActionDatasource({
    id: 1,
    uid: 'metrics',
    type: 'test',
    name: 'Metrics',
    access: 'proxy',
    readOnly: false,
    meta: {} as DataSourceApi['meta'],
    jsonData: {},
  });
  let resolve!: (value: DataSourceApi) => void;
  jest
    .mocked(getDataSourceInstance)
    .mockClear()
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce(datasource)
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
  const { data, context, store } = setup();
  const close = context.activateNotices!();
  await new Promise((done) => setTimeout(done, 0));
  expect(store.getSnapshot().items[0]).toMatchObject({ text: 'First error', actions: [] });
  data.setState({ data: response('Recovered') });
  await new Promise((done) => setTimeout(done, 0));
  expect(store.getSnapshot().items[0].actions?.map(({ label }) => label)).toEqual(['Retry Recovered']);
  expect(getDataSourceInstance).toHaveBeenCalledTimes(2);
  const changed = response('Other datasource');
  changed.request!.targets[0].datasource = { uid: 'other' };
  data.setState({ data: changed });
  close();
  resolve(datasource);
  await new Promise((done) => setTimeout(done, 0));
  expect(store.getSnapshot()).toEqual({ generation: 1, items: [], actions: {} });
});

it('gives cloned panels fresh runtime status state', () => {
  const panel = new VizPanel({ extendPanelContext: setupPanelNotices });
  panel
    .getPanelContext()
    .notices!.createSource()
    .set([{ id: 'a', severity: 'warning', text: 'Original panel' }]);
  const clone = panel.clone();
  clone
    .getPanelContext()
    .notices!.createSource()
    .set([{ id: 'a', severity: 'info', text: 'Cloned panel' }]);
  expect(
    panel
      .getPanelContext()
      .notices!.getSnapshot()
      .items.map(({ text }) => text)
  ).toEqual(['Original panel']);
  expect(
    clone
      .getPanelContext()
      .notices!.getSnapshot()
      .items.map(({ text }) => text)
  ).toEqual(['Cloned panel']);
});
