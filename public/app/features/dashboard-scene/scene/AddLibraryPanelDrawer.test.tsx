import { SceneGridLayout, SceneGridRow, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';

import { activateFullSceneTree } from '../utils/test-utils';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { DashboardGridItem } from './DashboardGridItem';
import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({}),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
}));

describe('AddLibraryPanelWidget', () => {
  let dashboard: DashboardScene;
  let addLibPanelDrawer: AddLibraryPanelDrawer;

  beforeEach(async () => {
    const result = await buildTestScene();
    dashboard = result.dashboard;
    addLibPanelDrawer = result.drawer;
  });

  it('should add library panel from menu', () => {
    const panelInfo: LibraryPanel = {
      uid: 'uid',
      model: {
        type: 'timeseries',
      },
      name: 'name',
      version: 1,
      type: 'timeseries',
    };

    addLibPanelDrawer.onAddLibraryPanel(panelInfo);

    const layout = dashboard.state.body as SceneGridLayout;
    const gridItem = layout.state.children[0] as DashboardGridItem;

    expect(layout.state.children.length).toBe(1);
    expect(gridItem.state.body!).toBeInstanceOf(VizPanel);
    expect(gridItem.state.body.state.$behaviors![0]).toBeInstanceOf(LibraryPanelBehavior);
    expect(gridItem.state.body.state.key).toBe('panel-1');
  });

  it('should add library panel from menu and enter edit mode in a dashboard that is not already in edit mode', async () => {
    const drawer = new AddLibraryPanelDrawer({});
    const dashboard = new DashboardScene({
      $timeRange: new SceneTimeRange({}),
      title: 'hello',
      uid: 'dash-1',
      version: 4,
      meta: {
        canEdit: true,
      },
      body: new SceneGridLayout({
        children: [],
      }),
      overlay: drawer,
    });

    activateFullSceneTree(dashboard);

    await new Promise((r) => setTimeout(r, 1));

    const panelInfo: LibraryPanel = {
      uid: 'uid',
      model: {
        type: 'timeseries',
      },
      name: 'name',
      version: 1,
      type: 'timeseries',
    };

    // if we are in a saved dashboard with no panels, adding a lib panel through
    // the CTA should enter edit mode
    expect(dashboard.state.isEditing).toBe(undefined);

    drawer.onAddLibraryPanel(panelInfo);

    const layout = dashboard.state.body as SceneGridLayout;
    const gridItem = layout.state.children[0] as DashboardGridItem;

    expect(layout.state.children.length).toBe(1);
    expect(gridItem.state.body!).toBeInstanceOf(VizPanel);
    expect(gridItem.state.body.state.$behaviors![0]).toBeInstanceOf(LibraryPanelBehavior);
    expect(gridItem.state.body.state.key).toBe('panel-1');
    expect(dashboard.state.isEditing).toBe(true);
  });

  it('should throw error if adding lib panel in a layout that is not SceneGridLayout', () => {
    dashboard.setState({ body: undefined });

    expect(() => addLibPanelDrawer.onAddLibraryPanel({} as LibraryPanel)).toThrow(
      'Trying to add a library panel in a layout that is not SceneGridLayout'
    );
  });

  it('should replace grid item when grid item state is passed', async () => {
    const libPanel = new VizPanel({
      title: 'Panel Title',
      pluginId: 'table',
      key: 'panel-1',
      $behaviors: [new LibraryPanelBehavior({ title: 'LibraryPanel A title', name: 'LibraryPanel A', uid: 'uid' })],
    });

    let gridItem = new DashboardGridItem({
      body: libPanel,
      key: 'grid-item-1',
    });
    addLibPanelDrawer = new AddLibraryPanelDrawer({ panelToReplaceRef: libPanel.getRef() });
    dashboard = new DashboardScene({
      $timeRange: new SceneTimeRange({}),
      title: 'hello',
      uid: 'dash-1',
      version: 4,
      meta: {
        canEdit: true,
      },
      body: new SceneGridLayout({
        children: [gridItem],
      }),
      overlay: addLibPanelDrawer,
    });

    const panelInfo: LibraryPanel = {
      uid: 'new_uid',
      model: {
        type: 'timeseries',
      },
      name: 'new_name',
      version: 1,
      type: 'timeseries',
    };

    addLibPanelDrawer.onAddLibraryPanel(panelInfo);

    const layout = dashboard.state.body as SceneGridLayout;
    gridItem = layout.state.children[0] as DashboardGridItem;
    const behavior = gridItem.state.body!.state.$behaviors![0] as LibraryPanelBehavior;

    expect(layout.state.children.length).toBe(1);
    expect(gridItem.state.body!).toBeInstanceOf(VizPanel);
    expect(behavior).toBeInstanceOf(LibraryPanelBehavior);
    expect(gridItem.state.key).toBe('grid-item-1');
    expect(behavior.state.uid).toBe('new_uid');
    expect(behavior.state.name).toBe('new_name');
  });

  it('should replace grid item in row when grid item state is passed', async () => {
    const libPanel = new VizPanel({
      title: 'Panel Title',
      pluginId: 'table',
      key: 'panel-1',
      $behaviors: [new LibraryPanelBehavior({ title: 'LibraryPanel A title', name: 'LibraryPanel A', uid: 'uid' })],
    });

    let gridItem = new DashboardGridItem({
      body: libPanel,
      key: 'grid-item-1',
    });
    addLibPanelDrawer = new AddLibraryPanelDrawer({ panelToReplaceRef: libPanel.getRef() });
    dashboard = new DashboardScene({
      $timeRange: new SceneTimeRange({}),
      title: 'hello',
      uid: 'dash-1',
      version: 4,
      meta: {
        canEdit: true,
      },
      body: new SceneGridLayout({
        children: [
          new SceneGridRow({
            children: [gridItem],
          }),
        ],
      }),
      overlay: addLibPanelDrawer,
    });

    const panelInfo: LibraryPanel = {
      uid: 'new_uid',
      model: {
        type: 'timeseries',
      },
      name: 'new_name',
      version: 1,
      type: 'timeseries',
    };

    addLibPanelDrawer.onAddLibraryPanel(panelInfo);

    const layout = dashboard.state.body as SceneGridLayout;
    const gridRow = layout.state.children[0] as SceneGridRow;
    gridItem = gridRow.state.children[0] as DashboardGridItem;
    const behavior = gridItem.state.body!.state.$behaviors![0] as LibraryPanelBehavior;

    expect(layout.state.children.length).toBe(1);
    expect(gridRow.state.children.length).toBe(1);
    expect(gridItem.state.body!).toBeInstanceOf(VizPanel);
    expect(behavior).toBeInstanceOf(LibraryPanelBehavior);
    expect(gridItem.state.key).toBe('grid-item-1');
    expect(behavior.state.uid).toBe('new_uid');
    expect(behavior.state.name).toBe('new_name');
  });
});

async function buildTestScene() {
  const drawer = new AddLibraryPanelDrawer({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
    meta: {
      canEdit: true,
    },
    body: new SceneGridLayout({
      children: [],
    }),
    overlay: drawer,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();

  return { dashboard, drawer };
}
