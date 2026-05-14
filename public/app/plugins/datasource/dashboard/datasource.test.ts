import { first, ReplaySubject } from 'rxjs';

import {
  arrayToDataFrame,
  DataFrame,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateTime,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  standardTransformersRegistry,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  SafeSerializableSceneObject,
  SceneDataNode,
  SceneDataProviderResult,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  VizPanel,
} from '@grafana/scenes';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { MIXED_REQUEST_PREFIX } from '../mixed/MixedDataSource';

import { DashboardDatasource } from './datasource';
import { DashboardQuery } from './types';

jest.mock('rxjs', () => {
  const original = jest.requireActual('rxjs');
  return {
    ...original,
    first: jest.fn(original.first),
  };
});

standardTransformersRegistry.setInit(getStandardTransformers);
setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('DashboardDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should look up the other panel and subscribe to it's data", async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 });

    let rsp: DataQueryResponse | undefined;

    observable.subscribe({ next: (data) => (rsp = data) });

    expect(rsp?.data[0].fields[0].values).toEqual([1, 2, 3]);
  });

  it('should always set response key', async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 });

    let rsp: DataQueryResponse | undefined;

    observable.subscribe({ next: (data) => (rsp = data) });

    expect(rsp?.key).toEqual('source-ds-provider');
  });

  it('Can subscribe to panel data + transforms', async () => {
    const { observable } = setup({ refId: 'A', panelId: 1, withTransforms: true });

    let rsp: DataQueryResponse | undefined;

    observable.subscribe({ next: (data) => (rsp = data) });

    expect(rsp?.data[0].fields[1].values).toEqual([3]);
  });

  it('Should activate source provder on observable subscribe and deactivate when completed (if only activator)', async () => {
    const { observable, sourceData } = setup({ refId: 'A', panelId: 1, withTransforms: true });

    const test = observable.subscribe({ next: () => {} });

    expect(sourceData.isActive).toBe(true);

    test.unsubscribe();

    expect(sourceData.isActive).toBe(false);
  });

  it('Should emit only the first value and complete if used within MixedDS', async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 }, `${MIXED_REQUEST_PREFIX}1`);

    observable.subscribe({ next: () => {} });

    expect(first).toHaveBeenCalled();
  });

  it('Should not get the first emission if requestId does not contain the MixedDS prefix', async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 });

    observable.subscribe({ next: () => {} });

    expect(first).not.toHaveBeenCalled();
  });

  it('Should skip the stale Done replayed by the upstream ReplaySubject on time-range change in MixedDS', async () => {
    // The upstream SceneQueryRunner exposes its results via a ReplaySubject(1)
    // that synchronously replays the previous range's Done state on subscribe.
    // The Mixed-DS operator's `first(Done || Error)` used to match that stale
    // Done and complete the substream before the upstream re-ran for the new
    // range, so the chain panel rendered with stale data and never re-rendered
    // when the real Done arrived seconds later.
    const oldRange = makeRange('2026-05-01T00:00:00Z', '2026-05-08T00:00:00Z');
    const newRange = makeRange('2026-05-04T00:00:00Z', '2026-05-08T00:00:00Z');

    const { observable, upstreamStream } = setupWithControllableUpstream(
      { refId: 'A', panelId: 1 },
      `${MIXED_REQUEST_PREFIX}1`,
      newRange
    );

    // Prime the ReplaySubject with the stale Done BEFORE subscribing, so it gets
    // replayed synchronously on subscribe, matching the production scenario.
    upstreamStream.next(makeResult(LoadingState.Done, arrayToDataFrame([1]), oldRange));

    const emissions: DataQueryResponse[] = [];
    observable.subscribe({ next: (data) => emissions.push(data) });

    await waitForDebounce();
    expect(emissions).toEqual([]);

    // Upstream now re-runs for the new range: Loading then Done.
    upstreamStream.next(makeResult(LoadingState.Loading, arrayToDataFrame([1]), newRange));
    upstreamStream.next(makeResult(LoadingState.Done, arrayToDataFrame([2, 3]), newRange));

    await waitForDebounce();
    expect(emissions).toHaveLength(1);
    expect(emissions[0].state).toBe(LoadingState.Done);
    expect(emissions[0].data[0].fields[0].values).toEqual([2, 3]);
  });

  it('Should still emit the only Done when ranges match (Mixed editor-add path)', async () => {
    // The filter must not skip the editor-add case: same range, single Done emission.
    const range = makeRange('2026-05-04T00:00:00Z', '2026-05-08T00:00:00Z');

    const { observable, upstreamStream } = setupWithControllableUpstream(
      { refId: 'A', panelId: 1 },
      `${MIXED_REQUEST_PREFIX}1`,
      range
    );

    upstreamStream.next(makeResult(LoadingState.Done, arrayToDataFrame([7, 8, 9]), range));

    const emissions: DataQueryResponse[] = [];
    observable.subscribe({ next: (data) => emissions.push(data) });

    await waitForDebounce();
    expect(emissions).toHaveLength(1);
    expect(emissions[0].state).toBe(LoadingState.Done);
    expect(emissions[0].data[0].fields[0].values).toEqual([7, 8, 9]);
  });

  it('Should not drop Done when the chain panel has a different range than the upstream (non-Mixed PanelTimeRange override)', async () => {
    // Regression guard: a chain panel with a PanelTimeRange override (timeFrom,
    // timeShift, ...) legitimately observes ranges that differ from the upstream.
    // The range-mismatch filter only runs on the Mixed-DS path; the non-Mixed
    // path must keep forwarding terminal emissions regardless of range.
    const chainRange = makeRange('2026-05-04T00:00:00Z', '2026-05-08T00:00:00Z');
    const upstreamRange = makeRange('2026-04-27T00:00:00Z', '2026-05-04T00:00:00Z');

    const { observable, upstreamStream } = setupWithControllableUpstream(
      { refId: 'A', panelId: 1 },
      /* non-Mixed requestId */ 'panel-1',
      chainRange
    );

    upstreamStream.next(makeResult(LoadingState.Done, arrayToDataFrame([42]), upstreamRange));

    const emissions: DataQueryResponse[] = [];
    observable.subscribe({ next: (data) => emissions.push(data) });

    await waitForDebounce();
    expect(emissions).toHaveLength(1);
    expect(emissions[0].state).toBe(LoadingState.Done);
    expect(emissions[0].data[0].fields[0].values).toEqual([42]);
  });
});

function setup(query: DashboardQuery, requestId?: string) {
  const sourceData = new SceneDataTransformer({
    $data: new SceneDataNode({
      data: {
        series: [arrayToDataFrame([1, 2, 3])],
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        structureRev: 11,
      },
    }),
    transformations: [{ id: 'reduce', options: {} }],
  });

  const scene = new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new VizPanel({
          key: getVizPanelKeyForPanelId(1),
          $data: sourceData,
        }),
      }),
    ],
  });

  const ds = new DashboardDatasource({} as DataSourceInstanceSettings);

  const observable = ds.query({
    timezone: 'utc',
    targets: [query],
    requestId: requestId ?? '',
    interval: '',
    intervalMs: 0,
    range: getDefaultTimeRange(),
    scopedVars: {
      __sceneObject: new SafeSerializableSceneObject(scene),
    },
    app: '',
    startTime: 0,
  });

  return { observable, sourceData };
}

function makeRange(fromIso: string, toIso: string) {
  const from = dateTime(fromIso);
  const to = dateTime(toIso);
  return { from, to, raw: { from, to } };
}

function makeResult(
  state: LoadingState,
  frame: DataFrame,
  range: ReturnType<typeof makeRange>
): SceneDataProviderResult {
  const data: PanelData = {
    series: [frame],
    state,
    timeRange: range,
    request: {
      requestId: 'upstream-req',
      interval: '',
      intervalMs: 0,
      range,
      scopedVars: {},
      targets: [],
      timezone: 'utc',
      app: '',
      startTime: 0,
    },
  };
  return { origin: undefined as unknown as SceneDataProviderResult['origin'], data };
}

function waitForDebounce() {
  // datasource.ts uses the Mixed-DS operator which adds an internal 400ms
  // debounce on the first Done. Wait long enough for it to drain.
  return new Promise((r) => setTimeout(r, 600));
}

function setupWithControllableUpstream(query: DashboardQuery, requestId: string, range: ReturnType<typeof makeRange>) {
  // Match production: upstream SceneQueryRunner exposes a ReplaySubject(1) so
  // subscribers attaching after the upstream has already emitted Done get the
  // stale Done replayed synchronously on subscribe.
  const upstreamStream = new ReplaySubject<SceneDataProviderResult>(1);

  const sourceData = new SceneDataNode({
    data: {
      series: [arrayToDataFrame([0])],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    },
  });
  jest.spyOn(sourceData, 'getResultsStream').mockReturnValue(upstreamStream);

  const scene = new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new VizPanel({
          key: getVizPanelKeyForPanelId(1),
          $data: sourceData,
        }),
      }),
    ],
  });

  const ds = new DashboardDatasource({} as DataSourceInstanceSettings);

  const observable = ds.query({
    timezone: 'utc',
    targets: [query],
    requestId,
    interval: '',
    intervalMs: 0,
    range,
    scopedVars: {
      __sceneObject: new SafeSerializableSceneObject(scene),
    },
    app: '',
    startTime: 0,
  });

  return { observable, upstreamStream, sourceData };
}
