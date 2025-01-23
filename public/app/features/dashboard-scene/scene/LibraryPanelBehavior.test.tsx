import { of } from 'rxjs';

import { FieldType, LoadingState, PanelData, getDefaultTimeRange, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { SceneCanvasText, sceneGraph, SceneGridLayout, VizPanel } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import * as libpanels from 'app/features/library-panels/state/api';

import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { NEW_LINK } from '../settings/links/utils';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { VizPanelLinks } from './PanelLinks';
import { PanelTimeRange } from './PanelTimeRange';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

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

describe('LibraryPanelBehavior', () => {
  it('should load library panel', async () => {
    const { gridItem, spy, behavior } = await buildTestSceneWithLibraryPanel();

    expect(behavior.state.isLoaded).toBe(true);
    expect(behavior.state._loadedPanel).toBeDefined();
    expect(behavior.state._loadedPanel?.model).toBeDefined();
    expect(behavior.state._loadedPanel?.name).toBe('LibraryPanel A');
    expect(behavior.state._loadedPanel?.type).toBe('table');

    // Verify the viz panel state have been updated with lib panel options
    expect(gridItem.state.body.state.options).toEqual({ showHeader: true });

    expect(spy).toHaveBeenCalled();
  });

  it('should include panel links', async () => {
    const { scene } = await buildTestSceneWithLibraryPanel();

    const panel = sceneGraph.findByKey(scene, 'panel-1') as VizPanel;
    expect(panel.state.titleItems).toBeDefined();
    const items = panel.state.titleItems as VizPanelLinks[];
    expect(items[0].state.rawLinks![0].title).toBe('link1');
  });

  it('should set panel timeRange if panel has query options set', async () => {
    const { gridItem } = await buildTestSceneWithLibraryPanel();

    const behavior = gridItem.state.body.state.$behaviors![0] as LibraryPanelBehavior;
    expect(behavior).toBeDefined();
    expect(gridItem.state.body.state.$timeRange).toBeUndefined();

    const panel = vizPanelToPanel(gridItem.state.body.clone({ $behaviors: undefined }));
    panel.timeFrom = '2h';
    panel.timeShift = '3h';

    const libraryPanelState = {
      name: 'LibraryPanel B',
      title: 'LibraryPanel B title',
      uid: '222',
      type: 'table',
      version: 2,
      model: panel,
    };

    behavior.setPanelFromLibPanel(libraryPanelState);

    expect(gridItem.state.body.state.$timeRange).toBeInstanceOf(PanelTimeRange);
  });

  it('should not update panel if version is the same', async () => {
    const { gridItem } = await buildTestSceneWithLibraryPanel();

    const behavior = gridItem.state.body.state.$behaviors![0] as LibraryPanelBehavior;
    expect(behavior).toBeDefined();

    const panel = vizPanelToPanel(gridItem.state.body.clone({ $behaviors: undefined }));

    const libraryPanelState = {
      name: 'LibraryPanel B',
      title: 'LibraryPanel B title',
      uid: '222',
      type: 'table',
      version: 1,
      model: panel,
    };

    behavior.setPanelFromLibPanel(libraryPanelState);

    expect(behavior.state._loadedPanel?.name).toBe('LibraryPanel A');
    expect(behavior.state._loadedPanel?.uid).toBe('111');
  });

  it('should not update panel if behavior not part of a vizPanel', async () => {
    const { gridItem } = await buildTestSceneWithLibraryPanel();

    const behavior = gridItem.state.body.state.$behaviors![0] as LibraryPanelBehavior;
    expect(behavior).toBeDefined();

    const panel = vizPanelToPanel(gridItem.state.body.clone({ $behaviors: undefined }));

    const libraryPanelState = {
      name: 'LibraryPanel B',
      title: 'LibraryPanel B title',
      uid: '222',
      type: 'table',
      version: 2,
      model: panel,
    };

    const behaviorClone = behavior.clone();
    behaviorClone.setPanelFromLibPanel(libraryPanelState);

    expect(behaviorClone.state._loadedPanel?.name).toBe('LibraryPanel A');
    expect(behaviorClone.state._loadedPanel?.uid).toBe('111');
  });
});

async function buildTestSceneWithLibraryPanel() {
  const behavior = new LibraryPanelBehavior({ name: 'LibraryPanel A', uid: '111' });

  const vizPanel = new VizPanel({
    title: 'Panel A',
    pluginId: 'lib-panel-loading',
    key: 'panel-1',
    $behaviors: [behavior],
  });

  const libraryPanel: LibraryPanel = {
    name: 'LibraryPanel A',
    uid: '111',
    type: 'table',
    model: {
      title: 'LibraryPanel A title',
      type: 'table',
      links: [{ ...NEW_LINK, title: 'link1' }],
      options: { showHeader: true },
      fieldConfig: { defaults: {}, overrides: [] },
      datasource: { uid: 'abcdef' },
      targets: [{ refId: 'A' }],
    },
    version: 1,
  };

  const spy = jest.spyOn(libpanels, 'getLibraryPanel').mockResolvedValue(libraryPanel);

  const gridItem = new DashboardGridItem({
    key: 'griditem-1',
    x: 0,
    y: 0,
    width: 10,
    height: 12,
    body: vizPanel,
  });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [gridItem],
      }),
    }),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  return { scene, gridItem, spy, behavior };
}
