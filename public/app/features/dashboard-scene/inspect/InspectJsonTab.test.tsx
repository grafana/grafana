import { of } from 'rxjs';

import {
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import {
  SceneCanvasText,
  SceneDataTransformer,
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import * as libpanels from 'app/features/library-panels/state/api';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import { findVizPanelByKey } from '../utils/utils';

import { InspectJsonTab } from './InspectJsonTab';

standardTransformersRegistry.setInit(getStandardTransformers);

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn(() => ({
    extensions: [],
  })),
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({
        getRef: () => ({ uid: 'ds1' }),
      }),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
}));

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
    series: [
      toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      }),
    ],
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
  })
);

setRunRequest(runRequestMock);

describe('InspectJsonTab', () => {
  it('Can show panel json', async () => {
    const { tab } = await buildTestScene();

    const obj = JSON.parse(tab.state.jsonText);
    expect(obj.gridPos).toEqual({ x: 0, y: 0, w: 10, h: 12 });
    expect(tab.isEditable()).toBe(true);
  });

  it('Can show panel json for library panels', async () => {
    const { tab } = await buildTestSceneWithLibraryPanel();

    const obj = JSON.parse(tab.state.jsonText);
    expect(obj.gridPos).toEqual({ x: 0, y: 0, w: 10, h: 12 });
    expect(obj.type).toEqual('table');
    expect(tab.isEditable()).toBe(false);
  });

  it('Can show panel data with field config', async () => {
    const { tab } = await buildTestScene();
    tab.onChangeSource({ value: 'panel-data' });
    expect(tab.isEditable()).toBe(false);

    const obj = JSON.parse(tab.state.jsonText);
    expect(obj.series.length).toBe(1);
    expect(obj.state).toBe(LoadingState.Done);

    // verify scopedVars __sceneObject is filtered out
    expect(obj.request.scopedVars.__sceneObject).toEqual('Filtered out in JSON serialization');
  });

  it('Can show raw data frames', async () => {
    const { tab } = await buildTestScene();
    tab.onChangeSource({ value: 'data-frames' });

    const obj = JSON.parse(tab.state.jsonText);
    expect(Array.isArray(obj)).toBe(true);
    expect(obj[0].schema.fields.length).toBe(1);
    expect(tab.isEditable()).toBe(false);
  });

  it('Can update model', async () => {
    const { tab, panel, scene } = await buildTestScene();

    tab.onCodeEditorBlur(`{
      "id": 12,
      "type": "table",
      "title": "New title",
      "gridPos": {
        "x": 1,
        "y": 2,
        "w": 3,
        "h": 4
      },
      "options": {},
      "fieldConfig": {},
      "transformations": [],
      "transparent": false
    }`);

    tab.onApplyChange();

    const panel2 = findVizPanelByKey(scene, panel.state.key)!;
    expect(panel2.state.title).toBe('New title');
    expect((panel2.parent as SceneGridItem).state.width!).toBe(3);

    expect(tab.state.onClose).toHaveBeenCalled();
  });
});

function buildTestPanel() {
  return new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    $data: new SceneDataTransformer({
      transformations: [
        {
          id: 'reduce',
          options: {
            reducers: ['last'],
          },
        },
      ],
      $data: new SceneQueryRunner({
        datasource: { uid: 'abcdef' },
        queries: [{ refId: 'A' }],
      }),
    }),
  });
}

async function buildTestScene() {
  const panel = buildTestPanel();
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
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
    panelRef: panel.getRef(),
    onClose: jest.fn(),
  });

  return { scene, tab, panel };
}

async function buildTestSceneWithLibraryPanel() {
  const panel = vizPanelToPanel(buildTestPanel());

  const libraryPanelState = {
    name: 'LibraryPanel A',
    title: 'LibraryPanel A title',
    uid: '111',
    panelKey: 'panel-22',
    model: panel,
    version: 1,
  };

  jest.spyOn(libpanels, 'getLibraryPanel').mockResolvedValue({ ...libraryPanelState, ...panel });
  const libraryPanel = new LibraryVizPanel(libraryPanelState);

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: libraryPanel,
        }),
      ],
    }),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  const tab = new InspectJsonTab({
    panelRef: libraryPanel.state.panel!.getRef(),
    onClose: jest.fn(),
  });

  return { scene, tab, panel };
}
