import { first } from 'rxjs';

import {
  arrayToDataFrame,
  DataQueryResponse,
  DataSourceInstanceSettings,
  getDefaultTimeRange,
  LoadingState,
  standardTransformersRegistry,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  SafeSerializableSceneObject,
  SceneDataNode,
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
    jest.useFakeTimers();

    const { observable } = setup({ refId: 'A', panelId: 1, withTransforms: true });

    let rsp: DataQueryResponse | undefined;

    observable.subscribe({ next: (data) => (rsp = data) });

    jest.runAllTimers();

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

  it('Should not mutate field state in dataframe', () => {
    jest.useFakeTimers();
    const { observable } = setup({ refId: 'A', panelId: 1, withTransforms: true });

    let rsp: DataQueryResponse | undefined;

    const test = observable.subscribe({ next: (data) => (rsp = data) });

    jest.runAllTimers();

    // modifying series in dashboard DS should not affect the original dataframe
    rsp!.data[0].fields[0].state = {
      calcs: { sum: 3 },
    };

    test.unsubscribe();

    observable.subscribe({ next: (data) => (rsp = data) });

    jest.runAllTimers();

    // on further emissions the result should be the unmodified original dataframe
    expect(rsp!.data[0].fields[0].state).toEqual({});
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
