import {
  arrayToDataFrame,
  DataQueryResponse,
  DataSourceInstanceSettings,
  getDefaultTimeRange,
  LoadingState,
  standardTransformersRegistry,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
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

import { DashboardDatasource } from './datasource';
import { DashboardQuery } from './types';

standardTransformersRegistry.setInit(getStandardTransformers);
setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('DashboardDatasource', () => {
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
});

function setup(query: DashboardQuery) {
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
    requestId: '',
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
