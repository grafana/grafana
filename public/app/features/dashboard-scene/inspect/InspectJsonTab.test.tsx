import { of } from 'rxjs';

import {
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  PanelPlugin,
  PluginType,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { SceneCanvasText, SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import * as libpanels from 'app/features/library-panels/state/api';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import { findVizPanelByKey } from '../utils/utils';

import { InspectJsonTab } from './InspectJsonTab';

standardTransformersRegistry.setInit(getStandardTransformers);
const panelPlugin: PanelPlugin = new PanelPlugin(() => null);
panelPlugin.meta = {
  id: 'table',
  name: 'Table',
  sort: 1,
  type: PluginType.panel,
  info: {
    author: {
      name: 'name',
    },
    description: '',
    links: [],
    logos: {
      large: '',
      small: '',
    },
    screenshots: [],
    updated: '',
    version: '1.0.',
  },
  module: '',
  baseUrl: '',
};

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => panelPlugin,
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
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'ds1',
    datasources: {
      ds1: {
        name: 'ds-uid',
        meta: {
          id: 'grafana',
        },
      },
    },
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
    expect(obj.gridPos).toEqual({ x: 0, y: 0, w: 8, h: 10 });
    expect(tab.isEditable()).toBe(true);
  });

  it('Can show panel json for library panels', async () => {
    const { tab } = await buildTestSceneWithLibraryPanel();

    const obj = JSON.parse(tab.state.jsonText);
    expect(obj.gridPos).toEqual({ x: 0, y: 0, w: 8, h: 10 });
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
    expect((panel2.parent as DashboardGridItem).state.width!).toBe(3);

    expect(tab.state.onClose).toHaveBeenCalled();
  });

  it('Can show panel json for V2 dashboard specification', async () => {
    const { tab } = await buildTestSceneWithV2Spec();

    const obj = JSON.parse(tab.state.jsonText);
    expect(obj.kind).toEqual('Panel');
    expect(obj.spec.id).toEqual(12);
    expect(obj.spec.data.kind).toEqual('QueryGroup');
    expect(tab.isEditable()).toBe(false);
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
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
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
  const libraryPanel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    $behaviors: [new LibraryPanelBehavior({ name: 'LibraryPanel A', uid: '111' })],
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

  const panel = vizPanelToPanel(libraryPanel.clone({ $behaviors: undefined }));

  const libraryPanelState = {
    name: 'LibraryPanel A',
    title: 'LibraryPanel A title',
    uid: '111',
    panelKey: 'panel-22',
    model: panel,
    type: 'table',
    version: 1,
  };

  jest.spyOn(libpanels, 'getLibraryPanel').mockResolvedValue({ ...libraryPanelState, ...panel });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    body: DefaultGridLayoutManager.fromVizPanels([libraryPanel]),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  const tab = new InspectJsonTab({
    panelRef: libraryPanel.getRef(),
    onClose: jest.fn(),
  });

  return { scene, tab, panel };
}

async function buildTestSceneWithV2Spec() {
  const panel = buildTestPanel();
  const scene = new DashboardScene(
    {
      title: 'hello',
      uid: 'dash-1',
      meta: {
        canEdit: true,
      },
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    'v2'
  );

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  const tab = new InspectJsonTab({
    panelRef: panel.getRef(),
    onClose: jest.fn(),
  });

  return { scene, tab, panel };
}
