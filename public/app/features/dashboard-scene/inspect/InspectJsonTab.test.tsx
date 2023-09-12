import { FieldType, getDefaultTimeRange, LoadingState, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  SceneCanvasText,
  SceneDataNode,
  SceneDataTransformer,
  SceneGridItem,
  SceneGridLayout,
  SceneObjectRef,
  VizPanel,
} from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { InspectJsonTab } from './InspectJsonTab';

standardTransformersRegistry.setInit(getStandardTransformers);

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('InspectJsonTab', () => {
  it('Can show panel json', async () => {
    const { tab } = await buildTestScene();

    const obj = JSON.parse(tab.state.jsonText);
    expect(obj.gridPos).toEqual({ x: 0, y: 0, w: 10, h: 12 });
    expect(tab.isReadOnly()).toBe(false);
  });

  it('Can show panel data with field config', async () => {
    const { tab } = await buildTestScene();
    tab.onChangeShow({ value: 'panel-data' });
    expect(tab.isReadOnly()).toBe(true);

    const obj = JSON.parse(tab.state.jsonText);
    expect(obj.series.length).toBe(1);
    expect(obj.state).toBe(LoadingState.Done);

    // verify scopedVars __sceneObject is filtered out
    expect(obj.request.scopedVars.__sceneObject).toEqual('Filtered out in JSON serialization');
  });

  it('Can show raw data frames', async () => {
    const { tab } = await buildTestScene();
    tab.onChangeShow({ value: 'data-frames' });

    const obj = JSON.parse(tab.state.jsonText);
    expect(Array.isArray(obj)).toBe(true);
    expect(obj[0].schema.fields.length).toBe(1);
    expect(tab.isReadOnly()).toBe(true);
  });
});

async function buildTestScene() {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    $data: new SceneDataTransformer({
      transformations: [
        {
          id: 'reduce',
          options: {
            reducers: ['last'],
          },
        },
      ],
      $data: new SceneDataNode({
        data: {
          state: LoadingState.Done,
          series: [
            toDataFrame({
              fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
            }),
          ],
          timeRange: getDefaultTimeRange(),
          request: {
            app: 'dashboard',
            requestId: 'request-id',
            dashboardUID: 'asd',
            interval: '1s',
            panelId: 1,
            range: getDefaultTimeRange(),
            targets: [],
            timezone: 'utc',
            intervalMs: 1000,
            startTime: 1,
            scopedVars: {
              __sceneObject: { value: new SceneCanvasText({ text: 'asd' }) },
            },
          },
        },
      }),
    }),
  });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: panel,
        }),
      ],
    }),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  const tab = new InspectJsonTab({
    panelRef: new SceneObjectRef(panel),
    label: 'a',
    value: InspectTab.JSON,
    canEdit: true,
  });

  return { scene, tab, panel };
}
