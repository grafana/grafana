import { locationService } from '@grafana/runtime';
import { getUrlSyncManager } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { setupLoadDashboardMock } from '../utils/test-utils';

import { DashboardScenePageStateManager } from './DashboardScenePageStateManager';

describe('DashboardScenePageStateManager', () => {
  describe('when fetching/loading a dashboard', () => {
    it('should call loader from server if the dashboard is not cached', async () => {
      const loadDashboardMock = setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadAndInit('fake-dash');

      expect(loadDashboardMock).toHaveBeenCalledWith('db', '', 'fake-dash');

      // should use cache second time
      await loader.loadAndInit('fake-dash');
      expect(loadDashboardMock.mock.calls.length).toBe(1);
    });

    it("should error when the dashboard doesn't exist", async () => {
      setupLoadDashboardMock({ dashboard: undefined, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadAndInit('fake-dash');

      expect(loader.state.dashboard).toBeUndefined();
      expect(loader.state.isLoading).toBe(false);
      expect(loader.state.loadError).toBe('Error: Dashboard not found');
    });

    it('should initialize the dashboard scene with the loaded dashboard', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadAndInit('fake-dash');

      expect(loader.state.dashboard?.state.uid).toBe('fake-dash');
      expect(loader.state.loadError).toBe(undefined);
      expect(loader.state.isLoading).toBe(false);
    });

    it('should use DashboardScene creator to initialize the scene', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadAndInit('fake-dash');

      expect(loader.state.dashboard).toBeInstanceOf(DashboardScene);
      expect(loader.state.isLoading).toBe(false);
    });

    it('should initialize url sync', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      locationService.partial({ from: 'now-5m', to: 'now' });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadAndInit('fake-dash');
      const dash = loader.state.dashboard;

      expect(dash!.state.$timeRange?.state.from).toEqual('now-5m');

      getUrlSyncManager().cleanUp(dash!);

      // try loading again (and hitting cache)
      locationService.partial({ from: 'now-10m', to: 'now' });

      await loader.loadAndInit('fake-dash');
      const dash2 = loader.state.dashboard;

      expect(dash2!.state.$timeRange?.state.from).toEqual('now-10m');
    });
  });
});
