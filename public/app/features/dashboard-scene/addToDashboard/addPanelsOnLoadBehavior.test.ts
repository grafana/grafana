import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { DASHBOARD_FROM_LS_KEY, type DashboardDTO } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { addPanelsOnLoadBehavior } from './addPanelsOnLoadBehavior';

function buildTestDTO(overrides: Partial<DashboardDTO['dashboard']> = {}): DashboardDTO {
  return {
    meta: {},
    dashboard: {
      title: '',
      uid: '',
      schemaVersion: 42,
      panels: [{ id: 1, type: 'timeseries', title: 'Test Panel', gridPos: { x: 0, y: 0, w: 12, h: 8 } }],
      ...overrides,
    },
  };
}

function buildTestScene(): DashboardScene {
  return new DashboardScene({
    title: 'Test Dashboard',
    uid: 'test-uid',
    $timeRange: new SceneTimeRange({}),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [] }),
    }),
  });
}

describe('addPanelsOnLoadBehavior', () => {
  const originalFT = config.featureToggles.dashboardNewLayouts;

  beforeEach(() => {
    config.featureToggles.dashboardNewLayouts = true;
  });

  afterEach(() => {
    config.featureToggles.dashboardNewLayouts = originalFT;
    store.delete(DASHBOARD_FROM_LS_KEY);
  });

  describe('when there is no data in localStorage', () => {
    it('does not call scene.addPanel and does not throw', () => {
      const scene = buildTestScene();
      scene.state.editPane.activate();
      const addPanelSpy = jest.spyOn(scene, 'addPanel');

      addPanelsOnLoadBehavior(scene);

      expect(addPanelSpy).not.toHaveBeenCalled();
      expect(() => addPanelsOnLoadBehavior(scene)).not.toThrow();
    });
  });

  describe('when data is present in localStorage', () => {
    it('always clears the LS key', () => {
      store.setObject(DASHBOARD_FROM_LS_KEY, buildTestDTO());
      const scene = buildTestScene();
      scene.state.editPane.activate();

      addPanelsOnLoadBehavior(scene);
      expect(store.exists(DASHBOARD_FROM_LS_KEY)).toBe(false);
    });

    it('adds each panel to the scene via scene.addPanel', () => {
      store.setObject(DASHBOARD_FROM_LS_KEY, buildTestDTO());
      const scene = buildTestScene();
      scene.state.editPane.activate();
      const addPanelSpy = jest.spyOn(scene, 'addPanel');

      addPanelsOnLoadBehavior(scene);

      expect(addPanelSpy).toHaveBeenCalledTimes(1);
      expect(addPanelSpy).toHaveBeenCalledWith(expect.any(VizPanel));
    });

    it('adds multiple panels when DTO contains multiple panels', () => {
      store.setObject(
        DASHBOARD_FROM_LS_KEY,
        buildTestDTO({
          panels: [
            { id: 1, type: 'timeseries', title: 'Panel 1', gridPos: { x: 0, y: 0, w: 12, h: 8 } },
            { id: 2, type: 'table', title: 'Panel 2', gridPos: { x: 0, y: 8, w: 12, h: 8 } },
          ],
        })
      );
      const scene = buildTestScene();
      scene.state.editPane.activate();
      const addPanelSpy = jest.spyOn(scene, 'addPanel');

      addPanelsOnLoadBehavior(scene);

      expect(addPanelSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('defers panel addition until editPane activates when it is not yet active', () => {
    store.setObject(DASHBOARD_FROM_LS_KEY, buildTestDTO());
    const scene = buildTestScene();
    const addPanelSpy = jest.spyOn(scene, 'addPanel');

    addPanelsOnLoadBehavior(scene);

    expect(addPanelSpy).not.toHaveBeenCalled();

    scene.state.editPane.activate();

    expect(addPanelSpy).toHaveBeenCalledTimes(1);
    expect(addPanelSpy).toHaveBeenCalledWith(expect.any(VizPanel));
  });

  describe('time range', () => {
    it('updates the scene time range when the DTO includes time', () => {
      const dto = buildTestDTO({ time: { from: 'now-6h', to: 'now' } });
      store.setObject(DASHBOARD_FROM_LS_KEY, dto);
      const scene = buildTestScene();
      scene.state.editPane.activate();

      addPanelsOnLoadBehavior(scene);

      expect(scene.state.$timeRange?.state.from).toBe('now-6h');
      expect(scene.state.$timeRange?.state.to).toBe('now');
    });

    it('does not modify the scene time range when the DTO has no time', () => {
      store.setObject(DASHBOARD_FROM_LS_KEY, buildTestDTO());
      const scene = buildTestScene();
      scene.state.editPane.activate();
      const originalFrom = scene.state.$timeRange?.state.from;
      const originalTo = scene.state.$timeRange?.state.to;

      addPanelsOnLoadBehavior(scene);

      expect(scene.state.$timeRange?.state.from).toBe(originalFrom);
      expect(scene.state.$timeRange?.state.to).toBe(originalTo);
    });
  });
});
