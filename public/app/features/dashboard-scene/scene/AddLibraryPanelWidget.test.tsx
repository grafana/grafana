import { SceneGridItem, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { AddLibraryPanelWidget } from './AddLibraryPanelWidget';
import { LibraryVizPanel } from './LibraryVizPanel';

describe('AddLibraryPanelWidget', () => {
  let dashboard: DashboardScene;
  let addLibPanelWidget: AddLibraryPanelWidget;
  const mockEvent = {
    preventDefault: jest.fn(),
  } as unknown as React.MouseEvent<HTMLButtonElement>;

  beforeEach(async () => {
    const result = await buildTestScene();
    dashboard = result.dashboard;
    addLibPanelWidget = result.addLibPanelWidget;
  });

  it('should return the dashboard', () => {
    expect(addLibPanelWidget.getDashboard()).toBe(dashboard);
  });

  it('should cancel adding a lib panel', () => {
    addLibPanelWidget.onCancelAddPanel(mockEvent);

    const body = dashboard.state.body as SceneGridLayout;

    expect(body.state.children.length).toBe(0);
  });

  it('should remove lib panel at index', () => {
    const anotherLibPanelWidget = new AddLibraryPanelWidget({ key: 'panel-2' });
    const body = dashboard.state.body as SceneGridLayout;
    body.setState({
      children: [
        ...body.state.children,
        new SceneGridItem({
          key: 'griditem-2',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: anotherLibPanelWidget,
        }),
      ],
    });

    anotherLibPanelWidget.onCancelAddPanel(mockEvent);

    const gridItem = body.state.children[0] as SceneGridItem;

    expect(body.state.children.length).toBe(1);
    expect(gridItem.state.body!.state.key).toBe(addLibPanelWidget.state.key);
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

    const body = dashboard.state.body as SceneGridLayout;
    const gridItem = body.state.children[0] as SceneGridItem;

    expect(gridItem.state.body!).toBeInstanceOf(AddLibraryPanelWidget);

    addLibPanelWidget.onAddLibraryPanel(panelInfo);

    expect(body.state.children.length).toBe(1);
    expect(gridItem.state.body!.state.key).toBe(addLibPanelWidget.state.key);
    expect(gridItem.state.body!).toBeInstanceOf(LibraryVizPanel);
  });

  it('should throw error if adding lib panel in a layout that is not SceneGridLayout', () => {
    dashboard.setState({
      body: undefined,
    });

    expect(() => addLibPanelWidget.onAddLibraryPanel({} as LibraryPanel)).toThrow(
      'Trying to add a library panel in a layout that is not SceneGridLayout'
    );
  });

  it('should throw error if removing the library panel widget in a layout that is not SceneGridLayout', () => {
    dashboard.setState({
      body: undefined,
    });

    expect(() => addLibPanelWidget.onCancelAddPanel(mockEvent)).toThrow(
      'Trying to remove the library panel widget in a layout that is not SceneGridLayout'
    );
  });
});

async function buildTestScene() {
  const addLibPanelWidget = new AddLibraryPanelWidget({ key: 'panel-1' });
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
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
          body: addLibPanelWidget,
        }),
      ],
    }),
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();

  return { dashboard, addLibPanelWidget };
}
