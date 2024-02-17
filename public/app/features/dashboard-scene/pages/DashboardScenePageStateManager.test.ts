import { advanceBy } from 'jest-date-mock';

import { locationService } from '@grafana/runtime';
import { getUrlSyncManager } from '@grafana/scenes';
import { DashboardRoutes } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';
import { setupLoadDashboardMock } from '../utils/test-utils';

import { DashboardScenePageStateManager, DASHBOARD_CACHE_TTL } from './DashboardScenePageStateManager';

describe('DashboardScenePageStateManager', () => {
  describe('when fetching/loading a dashboard', () => {
    it('should call loader from server if the dashboard is not cached', async () => {
      const loadDashboardMock = setupLoadDashboardMock({ dashboard: { uid: 'fake-dash', editable: true }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loadDashboardMock).toHaveBeenCalledWith('db', '', 'fake-dash');

      // should use cache second time
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
      expect(loadDashboardMock.mock.calls.length).toBe(1);
    });

    it("should error when the dashboard doesn't exist", async () => {
      setupLoadDashboardMock({ dashboard: undefined, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard).toBeUndefined();
      expect(loader.state.isLoading).toBe(false);
      expect(loader.state.loadError).toBe('Error: Dashboard not found');
    });

    it('should initialize the dashboard scene with the loaded dashboard', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard?.state.uid).toBe('fake-dash');
      expect(loader.state.loadError).toBe(undefined);
      expect(loader.state.isLoading).toBe(false);
    });

    it('should use DashboardScene creator to initialize the scene', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard).toBeInstanceOf(DashboardScene);
      expect(loader.state.isLoading).toBe(false);
    });

    it('should use DashboardScene creator to initialize the snapshot scene', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadSnapshot('fake-slug');

      expect(loader.state.dashboard).toBeInstanceOf(DashboardScene);
      expect(loader.state.isLoading).toBe(false);
    });

    it('should initialize url sync', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      locationService.partial({ from: 'now-5m', to: 'now' });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
      const dash = loader.state.dashboard;

      expect(dash!.state.$timeRange?.state.from).toEqual('now-5m');

      getUrlSyncManager().cleanUp(dash!);

      // try loading again (and hitting cache)
      locationService.partial({ from: 'now-10m', to: 'now' });

      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
      const dash2 = loader.state.dashboard;

      expect(dash2!.state.$timeRange?.state.from).toEqual('now-10m');
    });

    it('should not initialize url sync for embedded dashboards', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

      locationService.partial({ from: 'now-5m', to: 'now' });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Embedded });
      const dash = loader.state.dashboard;

      expect(dash!.state.$timeRange?.state.from).toEqual('now-6h');
    });

    describe('New dashboards', () => {
      it('Should have new empty model with meta.isNew and should not be cached', async () => {
        const loader = new DashboardScenePageStateManager({});

        await loader.loadDashboard({ uid: '', route: DashboardRoutes.New });
        const dashboard = loader.state.dashboard!;

        expect(dashboard.state.meta.isNew).toBe(true);
        expect(dashboard.state.isEditing).toBe(true);
        expect(dashboard.state.isDirty).toBe(true);

        dashboard.setState({ title: 'Changed' });

        await loader.loadDashboard({ uid: '', route: DashboardRoutes.New });
        const dashboard2 = loader.state.dashboard!;

        expect(dashboard2.state.title).toBe('New dashboard');
      });
    });

    describe('caching', () => {
      it('should take scene from cache if it exists', async () => {
        setupLoadDashboardMock({ dashboard: { uid: 'fake-dash', version: 10 }, meta: {} });

        const loader = new DashboardScenePageStateManager({});

        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        loader.state.dashboard?.onEnterEditMode();

        expect(loader.state.dashboard?.state.isEditing).toBe(true);

        loader.clearState();

        // now load it again
        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        // should still be editing
        expect(loader.state.dashboard?.state.isEditing).toBe(true);
        expect(loader.state.dashboard?.state.version).toBe(10);

        loader.clearState();

        loader.setDashboardCache('fake-dash', {
          dashboard: { title: 'new version', uid: 'fake-dash', version: 11, schemaVersion: 30 },
          meta: {},
        });

        // now load a third time
        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        expect(loader.state.dashboard!.state.isEditing).toBe(undefined);
        expect(loader.state.dashboard!.state.version).toBe(11);
      });

      it('should cache the dashboard DTO', async () => {
        setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });

        const loader = new DashboardScenePageStateManager({});

        expect(loader.getFromCache('fake-dash')).toBeNull();

        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        expect(loader.getFromCache('fake-dash')).toBeDefined();
      });

      it('should load dashboard DTO from cache if requested again within 2s', async () => {
        const loadDashSpy = jest.fn();
        setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} }, loadDashSpy);

        const loader = new DashboardScenePageStateManager({});

        expect(loader.getFromCache('fake-dash')).toBeNull();

        await loader.fetchDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
        expect(loadDashSpy).toHaveBeenCalledTimes(1);

        advanceBy(DASHBOARD_CACHE_TTL / 2);
        await loader.fetchDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
        expect(loadDashSpy).toHaveBeenCalledTimes(1);

        advanceBy(DASHBOARD_CACHE_TTL / 2 + 1);
        await loader.fetchDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
        expect(loadDashSpy).toHaveBeenCalledTimes(2);
      });
    });
  });
});
