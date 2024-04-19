import { SceneGridLayout, SceneTimeRange } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';

import { activateFullSceneTree } from '../utils/test-utils';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { DashboardGridItem } from './DashboardGridItem';
import { DashboardScene } from './DashboardScene';
import { LibraryVizPanel } from './LibraryVizPanel';

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
    expect(gridItem.state.body!).toBeInstanceOf(LibraryVizPanel);
    expect((gridItem.state.body! as LibraryVizPanel).state.panelKey).toBe('panel-1');
  });

  it('should throw error if adding lib panel in a layout that is not SceneGridLayout', () => {
    dashboard.setState({ body: undefined });

    expect(() => addLibPanelDrawer.onAddLibraryPanel({} as LibraryPanel)).toThrow(
      'Trying to add a library panel in a layout that is not SceneGridLayout'
    );
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
