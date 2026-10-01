import { AppEvents, type DashboardQueryPolicy, type DataSourceRef } from '@grafana/data';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type LibraryPanel } from '@grafana/schema';

import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';
import { activateFullSceneTree } from '../utils/test-utils';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

const mockPublish = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => ({ publish: mockPublish }),
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

describe('AddLibraryPanelWidget', () => {
  let dashboard: DashboardScene;
  let addLibPanelDrawer: AddLibraryPanelDrawer;

  beforeEach(async () => {
    const result = await buildTestScene();
    dashboard = result.dashboard;
    addLibPanelDrawer = result.drawer;
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

describe('AddLibraryPanelDrawer with a dashboard query policy', () => {
  const RESTRICTED = 'restricted-datasource';
  const refA: DataSourceRef = { type: RESTRICTED, uid: 'instance-a' };
  const refB: DataSourceRef = { type: RESTRICTED, uid: 'instance-b' };
  const policy: DashboardQueryPolicy = {
    restrictSamePluginToThisInstance: true,
    defaultForNewPanels: true,
    reason: 'Dashboard is bound to instance A.',
  };
  const refusalToast = {
    type: AppEvents.alertError.name,
    payload: ["This panel can't be added to this dashboard", policy.reason],
  };

  const libraryPanel = (model: Partial<LibraryPanel['model']>): LibraryPanel => ({
    uid: 'uid',
    model: { title: 'model title', type: 'timeseries', ...model },
    name: 'name',
    version: 1,
    type: 'timeseries',
  });

  let dashboard: DashboardScene;
  let drawer: AddLibraryPanelDrawer;

  beforeEach(async () => {
    mockPublish.mockClear();

    const result = await buildTestScene();
    dashboard = result.dashboard;
    drawer = result.drawer;
    dashboard.setState({ queryPolicies: { [RESTRICTED]: { uid: 'instance-a', policy } } });
  });

  it('refuses a library panel whose model uses an excluded instance and keeps the drawer open', async () => {
    await drawer.onAddLibraryPanel(libraryPanel({ datasource: refB, targets: [{ refId: 'A' }] }));

    expect(dashboard.state.body.getVizPanels()).toHaveLength(0);
    expect(dashboard.state.overlay).toBe(drawer);
    expect(mockPublish).toHaveBeenCalledWith(refusalToast);
  });

  it('refuses a library panel with a target on an excluded instance', async () => {
    await drawer.onAddLibraryPanel(libraryPanel({ datasource: refA, targets: [{ refId: 'A', datasource: refB }] }));

    expect(dashboard.state.body.getVizPanels()).toHaveLength(0);
    expect(mockPublish).toHaveBeenCalledWith(refusalToast);
  });

  it('adds a library panel on the bound instance and starts its placeholder there', async () => {
    await drawer.onAddLibraryPanel(libraryPanel({ datasource: refA, targets: [{ refId: 'A' }] }));

    const panels = dashboard.state.body.getVizPanels();
    expect(panels).toHaveLength(1);
    expect(getQueryRunnerFor(panels[0])?.state.datasource).toEqual(refA);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('adds a library panel of another plugin type', async () => {
    await drawer.onAddLibraryPanel(
      libraryPanel({ datasource: { type: 'prometheus', uid: 'prom' }, targets: [{ refId: 'A' }] })
    );

    expect(dashboard.state.body.getVizPanels()).toHaveLength(1);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('refuses to replace a panel with a library panel on an excluded instance', async () => {
    const existing = new VizPanel({ title: 'Existing', pluginId: 'table', key: 'panel-1' });
    const replaceDrawer = new AddLibraryPanelDrawer({ panelToReplaceRef: existing.getRef() });
    const replaceDashboard = new DashboardScene({
      $timeRange: new SceneTimeRange({}),
      title: 'hello',
      uid: 'dash-1',
      version: 4,
      meta: { canEdit: true },
      queryPolicies: { [RESTRICTED]: { uid: 'instance-a', policy } },
      body: DefaultGridLayoutManager.fromVizPanels([existing]),
      overlay: replaceDrawer,
    });

    await replaceDrawer.onAddLibraryPanel(libraryPanel({ datasource: refB, targets: [{ refId: 'A' }] }));

    const panels = replaceDashboard.state.body.getVizPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0]).toBe(existing);
    expect(replaceDashboard.state.overlay).toBe(replaceDrawer);
    expect(mockPublish).toHaveBeenCalledWith(refusalToast);
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
