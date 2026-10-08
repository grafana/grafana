import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type LibraryPanel } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { replacePanel } from '../actions/panel/replacePanel';
import { activateFullSceneTree } from '../utils/test-utils';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({}),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
}));

jest.mock('../actions/panel/replacePanel');

describe('AddLibraryPanelWidget', () => {
  let dashboard: DashboardScene;
  let addLibPanelDrawer: AddLibraryPanelDrawer;

  beforeEach(async () => {
    const result = await buildTestScene();
    dashboard = result.dashboard;
    addLibPanelDrawer = result.drawer;
    setTestFlags({ dashboardNewLayouts: false });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('should add library panel from menu', async () => {
    const panelInfo: LibraryPanel = {
      uid: 'uid',
      model: {
        title: 'model title',
        type: 'timeseries',
      },
      name: 'name',
      version: 1,
      type: 'timeseries',
    };

    await addLibPanelDrawer.onAddLibraryPanel(panelInfo);

    const panels = dashboard.state.body.getVizPanels();
    const panel = panels[0];

    expect(panels.length).toBe(1);
    expect(panel.state.$behaviors![0]).toBeInstanceOf(LibraryPanelBehavior);
    expect(panel.state.key).toBe('panel-1');
    expect(panel.state.title).toBe('model title');
    expect(panel.state.hoverHeader).toBe(false);
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
      overlay: drawer,
    });

    activateFullSceneTree(dashboard);

    await new Promise((r) => setTimeout(r, 1));

    const panelInfo: LibraryPanel = {
      uid: 'uid',
      model: {
        title: 'model title',
        type: 'timeseries',
      },
      name: 'name',
      version: 1,
      type: 'timeseries',
    };

    // if we are in a saved dashboard with no panels, adding a lib panel through
    // the CTA should enter edit mode
    expect(dashboard.state.isEditing).toBe(undefined);

    await drawer.onAddLibraryPanel(panelInfo);

    const panels = dashboard.state.body.getVizPanels();
    const panel = panels[0];

    expect(panels.length).toBe(1);
    expect(panel.state.$behaviors![0]).toBeInstanceOf(LibraryPanelBehavior);
    expect(panel.state.key).toBe('panel-1');
    expect(panel.state.title).toBe('model title');
    expect(dashboard.state.isEditing).toBe(true);
  });

  it('should replace grid item when grid item state is passed', async () => {
    const libPanel = new VizPanel({
      title: 'Some panel title',
      pluginId: 'table',
      key: 'panel-1',
      $behaviors: [new LibraryPanelBehavior({ name: 'LibraryPanel A', uid: 'uid' })],
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
      body: DefaultGridLayoutManager.fromVizPanels([libPanel]),
      overlay: addLibPanelDrawer,
    });

    const panelInfo: LibraryPanel = {
      uid: 'new_uid',
      model: {
        title: 'model title',
        type: 'timeseries',
      },
      name: 'new_name',
      version: 1,
      type: 'timeseries',
    };

    await addLibPanelDrawer.onAddLibraryPanel(panelInfo);

    const panels = dashboard.state.body.getVizPanels();
    expect(panels.length).toBe(1);

    const behavior = panels[0].state.$behaviors![0] as LibraryPanelBehavior;

    expect(behavior).toBeInstanceOf(LibraryPanelBehavior);
    expect(behavior.state.uid).toBe('new_uid');
    expect(behavior.state.name).toBe('new_name');
    expect(panels[0].state.title).toBe('model title');
    expect(panels[0].state.key).toBe('panel-1'); // Key should be preserved from original panel
  });

  describe('with new layouts', () => {
    beforeEach(() => {
      setTestFlags({ dashboardNewLayouts: true });
    });

    afterEach(() => {
      setTestFlags({});
    });

    it('delegates replacement to the action with the prepared library panel', async () => {
      const oldPanel = new VizPanel({ key: 'panel-1', title: 'Original', pluginId: 'table' });
      const drawer = new AddLibraryPanelDrawer({ panelToReplaceRef: oldPanel.getRef() });
      const dashboard = new DashboardScene({
        body: DefaultGridLayoutManager.fromVizPanels([oldPanel]),
        overlay: drawer,
      });
      const source = oldPanel.parent;
      const panelInfo: LibraryPanel = {
        uid: 'library-1',
        name: 'Library panel',
        version: 1,
        type: 'timeseries',
        model: { title: 'Library title', type: 'timeseries' },
      };

      await drawer.onAddLibraryPanel(panelInfo);

      expect(replacePanel).toHaveBeenCalledTimes(1);
      expect(replacePanel).toHaveBeenCalledWith({ source, oldPanel, newPanel: expect.any(VizPanel) });
      const { newPanel } = jest.mocked(replacePanel).mock.calls[0][0];
      expect(newPanel.state).toMatchObject({ title: 'Library title', hoverHeader: false });
      const behavior = newPanel.state.$behaviors?.[0] as LibraryPanelBehavior;
      expect(behavior.state).toMatchObject({ uid: 'library-1', name: 'Library panel' });
      expect(dashboard.state.body.getVizPanels()).toEqual([oldPanel]);
    });
  });

  it('should set hoverHeader to true if the library panel title is empty', async () => {
    const panelInfo: LibraryPanel = {
      uid: 'uid',
      model: {
        title: '',
        type: 'timeseries',
      },
      name: 'name',
      version: 1,
      type: 'timeseries',
    };

    await addLibPanelDrawer.onAddLibraryPanel(panelInfo);

    const panels = dashboard.state.body.getVizPanels();
    const panel = panels[0];
    expect(panel.state.title).toBe('');
    expect(panel.state.hoverHeader).toBe(true);
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
    overlay: drawer,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();

  return { dashboard, drawer };
}
