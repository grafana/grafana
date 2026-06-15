import { SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { KioskMode } from 'app/types/dashboard';

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

describe('DashboardSceneUrlSync', () => {
  describe('Given a standard scene', () => {
    it('Should set UNSAFE_fitPanels when url has autofitpanels', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ autofitpanels: '' });
      const layout = scene.state.body as DefaultGridLayoutManager;

      expect(layout.state.grid.state.UNSAFE_fitPanels).toBe(true);
    });

    it('Should get the autofitpanels from the scene state', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().autofitpanels).toBeUndefined();
      const layout = scene.state.body as DefaultGridLayoutManager;
      layout.state.grid.setState({ UNSAFE_fitPanels: true });
      expect(scene.urlSync?.getUrlState().autofitpanels).toBe('true');
    });

    it('Should set kiosk mode when url has kiosk', () => {
      const scene = buildTestScene();

      scene.urlSync?.updateFromUrl({ kiosk: 'invalid' });
      expect(scene.state.kioskMode).toBe(undefined);
      scene.urlSync?.updateFromUrl({ kiosk: '' });
      expect(scene.state.kioskMode).toBe(KioskMode.Full);
      scene.urlSync?.updateFromUrl({ kiosk: 'true' });
      expect(scene.state.kioskMode).toBe(KioskMode.Full);
    });

    it('Should set embed kiosk mode when url has kiosk=embed', () => {
      const scene = buildTestScene();

      scene.urlSync?.updateFromUrl({ kiosk: 'embed' });
      expect(scene.state.kioskMode).toBe(KioskMode.Embed);
    });

    it('Should NOT set kiosk mode for random/invalid values', () => {
      const scene = buildTestScene();

      scene.urlSync?.updateFromUrl({ kiosk: 'random' });
      expect(scene.state.kioskMode).toBe(undefined);

      scene.urlSync?.updateFromUrl({ kiosk: 'tv' });
      expect(scene.state.kioskMode).toBe(undefined);

      scene.urlSync?.updateFromUrl({ kiosk: 'false' });
      expect(scene.state.kioskMode).toBe(undefined);
    });

    it('Should get the kiosk mode from the scene state', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().kiosk).toBe(undefined);
      scene.setState({ kioskMode: KioskMode.Full });
      expect(scene.urlSync?.getUrlState().kiosk).toBe('true');
    });

    it('Should get embed kiosk url state from the scene state', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().kiosk).toBe(undefined);
      scene.setState({ kioskMode: KioskMode.Embed });
      expect(scene.urlSync?.getUrlState().kiosk).toBe('embed');
    });

    it('Should return undefined kiosk url state when no kiosk mode is set', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().kiosk).toBe(undefined);
      scene.setState({ kioskMode: undefined });
      expect(scene.urlSync?.getUrlState().kiosk).toBe(undefined);
    });
  });

  describe('entering edit mode', () => {
    it('it should be possible to go from the view panel view to the edit view when the dashboard is not in edit mdoe', () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false });
      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });
      expect(scene.state.viewPanel).toBeDefined();
      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
      expect(scene.state.editPanel).toBeDefined();
    });
  });
});

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),

      new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    ]),
  });

  return scene;
}
