import { advanceBy } from 'jest-date-mock';

import { BackendSrv, setBackendSrv } from '@grafana/runtime';
import { DashboardV2Spec, defaultDashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import store from 'app/core/store';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { getDashboardSnapshotSrv } from 'app/features/dashboard/services/SnapshotSrv';
import { DASHBOARD_FROM_LS_KEY, DashboardRoutes } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';
import { setupLoadDashboardMock, setupLoadDashboardMockReject } from '../utils/test-utils';

import {
  DashboardScenePageStateManager,
  DASHBOARD_CACHE_TTL,
  DashboardScenePageStateManagerV2,
} from './DashboardScenePageStateManager';

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
}));

describe('DashboardScenePageStateManager v1', () => {
  afterEach(() => {
    store.delete(DASHBOARD_FROM_LS_KEY);

    setBackendSrv({
      get: jest.fn(),
    } as unknown as BackendSrv);
  });

  describe('when fetching/loading a dashboard', () => {
    it('should call loader from server if the dashboard is not cached', async () => {
      const loadDashboardMock = setupLoadDashboardMock({ dashboard: { uid: 'fake-dash', editable: true }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loadDashboardMock).toHaveBeenCalledWith('db', '', 'fake-dash', undefined);

      // should use cache second time
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
      expect(loadDashboardMock.mock.calls.length).toBe(1);
    });

    it("should error when the dashboard doesn't exist", async () => {
      setupLoadDashboardMockReject({
        status: 404,
        statusText: 'Not Found',
        data: {
          message: 'Dashboard not found',
        },
        config: {
          method: 'GET',
          url: 'api/dashboards/uid/adfjq9edwm0hsdsa',
          retry: 0,
          headers: {
            'X-Grafana-Org-Id': 1,
          },
          hideFromInspector: true,
        },
        isHandled: true,
      });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard).toBeUndefined();
      expect(loader.state.isLoading).toBe(false);
      expect(loader.state.loadError).toEqual({
        status: 404,
        messageId: undefined,
        message: 'Dashboard not found',
      });
    });

    it('should clear current dashboard while loading next', async () => {
      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash', editable: true }, meta: {} });

      const loader = new DashboardScenePageStateManager({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard).toBeDefined();

      setupLoadDashboardMock({ dashboard: { uid: 'fake-dash2', editable: true }, meta: {} });

      loader.loadDashboard({ uid: 'fake-dash2', route: DashboardRoutes.Normal });

      expect(loader.state.isLoading).toBe(true);
      expect(loader.state.dashboard).toBeUndefined();
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

    describe('Home dashboard', () => {
      it('should handle home dashboard redirect', async () => {
        setBackendSrv({
          get: () => Promise.resolve({ redirectUri: '/d/asd' }),
        } as unknown as BackendSrv);

        const loader = new DashboardScenePageStateManager({});
        await loader.loadDashboard({ uid: '', route: DashboardRoutes.Home });

        expect(loader.state.dashboard).toBeUndefined();
        expect(loader.state.loadError).toBeUndefined();
      });

      it('should handle invalid home dashboard request', async () => {
        setBackendSrv({
          get: () =>
            Promise.reject({
              status: 500,
              data: { message: 'Failed to load home dashboard' },
            }),
        } as unknown as BackendSrv);

        const loader = new DashboardScenePageStateManager({});
        await loader.loadDashboard({ uid: '', route: DashboardRoutes.Home });

        expect(loader.state.dashboard).toBeUndefined();
        expect(loader.state.loadError).toEqual({
          message: 'Failed to load home dashboard',
          messageId: undefined,
          status: 500,
        });
      });

      it('should throw when v2 custom home dashboard is provided', async () => {
        setBackendSrv({
          get: () => Promise.resolve({ dashboard: customHomeDashboardV2Spec, meta: {} }),
        } as unknown as BackendSrv);

        const loader = new DashboardScenePageStateManager({});
        await loader.loadDashboard({ uid: '', route: DashboardRoutes.Home });

        expect(loader.state.dashboard).toBeUndefined();
        expect(loader.state.loadError).toEqual({
          message: 'v2 dashboard spec is not supported. Enable useV2DashboardsAPI feature toggle',
          messageId: undefined,
          status: undefined,
        });
      });
    });

    describe('New dashboards', () => {
      it('Should have new empty model and should not be cached', async () => {
        const loader = new DashboardScenePageStateManager({});

        await loader.loadDashboard({ uid: '', route: DashboardRoutes.New });
        const dashboard = loader.state.dashboard!;

        expect(dashboard.state.isEditing).toBe(undefined);
        expect(dashboard.state.isDirty).toBe(false);

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

        expect(loader.getDashboardFromCache('fake-dash')).toBeNull();

        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        expect(loader.getDashboardFromCache('fake-dash')).toBeDefined();
      });

      it('should load dashboard DTO from cache if requested again within 2s', async () => {
        const loadDashSpy = jest.fn();
        setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} }, loadDashSpy);

        const loader = new DashboardScenePageStateManager({});

        expect(loader.getDashboardFromCache('fake-dash')).toBeNull();

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

describe('DashboardScenePageStateManager v2', () => {
  afterEach(() => {
    store.delete(DASHBOARD_FROM_LS_KEY);
  });

  describe('when fetching/loading a dashboard', () => {
    const setupDashboardAPI = (
      d: DashboardWithAccessInfo<DashboardV2Spec> | undefined,
      spy: jest.Mock,
      effect?: () => void
    ) => {
      (getDashboardAPI as jest.Mock).mockImplementation(() => {
        // Return whatever you want for this mock
        return {
          getDashboardDTO: async () => {
            spy();
            effect?.();
            return d;
          },
          deleteDashboard: jest.fn(),
          saveDashboard: jest.fn(),
        };
      });
    };
    it('should call loader from server if the dashboard is not cached', async () => {
      const getDashSpy = jest.fn();
      setupDashboardAPI(
        {
          access: {},
          apiVersion: 'v2alpha1',
          kind: 'DashboardWithAccessInfo',
          metadata: {
            name: 'fake-dash',
            creationTimestamp: '',
            resourceVersion: '1',
          },
          spec: { ...defaultDashboardV2Spec() },
        },
        getDashSpy
      );

      const loader = new DashboardScenePageStateManagerV2({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(getDashSpy).toHaveBeenCalledTimes(1);

      // should use cache second time
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
      expect(getDashSpy).toHaveBeenCalledTimes(1);
    });

    // TODO: Fix this test, v2 does not return undefined dashboard, but throws instead. The code needs to be updated.
    it.skip("should error when the dashboard doesn't exist", async () => {
      const getDashSpy = jest.fn();
      setupDashboardAPI(undefined, getDashSpy, () => {
        throw new Error('Dashhboard not found');
      });

      const loader = new DashboardScenePageStateManagerV2({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      // expect(loader.state.dashboard).toBeUndefined();
      expect(loader.state.isLoading).toBe(false);
      expect(loader.state.loadError).toBe('Dashboard not found');
    });

    it('should clear current dashboard while loading next', async () => {
      const getDashSpy = jest.fn();
      setupDashboardAPI(
        {
          access: {},
          apiVersion: 'v2alpha1',
          kind: 'DashboardWithAccessInfo',
          metadata: {
            name: 'fake-dash',
            creationTimestamp: '',
            resourceVersion: '1',
          },
          spec: { ...defaultDashboardV2Spec() },
        },
        getDashSpy
      );

      const loader = new DashboardScenePageStateManagerV2({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard).toBeDefined();

      setupDashboardAPI(
        {
          access: {},
          apiVersion: 'v2alpha1',
          kind: 'DashboardWithAccessInfo',
          metadata: {
            name: 'fake-dash2',
            creationTimestamp: '',
            resourceVersion: '1',
          },
          spec: { ...defaultDashboardV2Spec() },
        },
        getDashSpy
      );

      loader.loadDashboard({ uid: 'fake-dash2', route: DashboardRoutes.Normal });

      expect(loader.state.isLoading).toBe(true);
      expect(loader.state.dashboard).toBeUndefined();
    });

    it('should initialize the dashboard scene with the loaded dashboard', async () => {
      const getDashSpy = jest.fn();
      setupDashboardAPI(
        {
          access: {},
          apiVersion: 'v2alpha1',
          kind: 'DashboardWithAccessInfo',
          metadata: {
            name: 'fake-dash',
            creationTimestamp: '',
            resourceVersion: '1',
          },
          spec: { ...defaultDashboardV2Spec() },
        },
        getDashSpy
      );

      const loader = new DashboardScenePageStateManagerV2({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard?.state.uid).toBe('fake-dash');
      expect(loader.state.loadError).toBe(undefined);
      expect(loader.state.isLoading).toBe(false);
    });

    it('should use DashboardScene creator to initialize the scene', async () => {
      const getDashSpy = jest.fn();
      setupDashboardAPI(
        {
          access: {},
          apiVersion: 'v2alpha1',
          kind: 'DashboardWithAccessInfo',
          metadata: {
            name: 'fake-dash',
            creationTimestamp: '',
            resourceVersion: '1',
          },
          spec: { ...defaultDashboardV2Spec() },
        },
        getDashSpy
      );

      const loader = new DashboardScenePageStateManagerV2({});
      await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

      expect(loader.state.dashboard).toBeInstanceOf(DashboardScene);
      expect(loader.state.isLoading).toBe(false);
    });

    it('should use DashboardScene creator to initialize the snapshot scene', async () => {
      jest.spyOn(getDashboardSnapshotSrv(), 'getSnapshot').mockResolvedValue({
        // getSnapshot will return v1 dashboard
        // but ResponseTransformer in DashboardLoaderSrv will convert it to v2
        dashboard: {
          uid: 'fake-dash',
          title: 'Fake dashboard',
          schemaVersion: 40,
        },
        meta: { isSnapshot: true },
      });

      const loader = new DashboardScenePageStateManagerV2({});
      await loader.loadSnapshot('fake-slug');

      expect(loader.state.dashboard).toBeInstanceOf(DashboardScene);
      expect(loader.state.isLoading).toBe(false);
    });

    describe('Home dashboard', () => {
      it('should handle home dashboard redirect', async () => {
        setBackendSrv({
          get: () => Promise.resolve({ redirectUri: '/d/asd' }),
        } as unknown as BackendSrv);

        const loader = new DashboardScenePageStateManagerV2({});
        await loader.loadDashboard({ uid: '', route: DashboardRoutes.Home });

        expect(loader.state.dashboard).toBeUndefined();
        expect(loader.state.loadError).toBeUndefined();
      });

      it('should handle invalid home dashboard request', async () => {
        setBackendSrv({
          get: () =>
            Promise.reject({
              status: 500,
              data: { message: 'Failed to load home dashboard' },
            }),
        } as unknown as BackendSrv);

        const loader = new DashboardScenePageStateManagerV2({});
        await loader.loadDashboard({ uid: '', route: DashboardRoutes.Home });

        expect(loader.state.dashboard).toBeUndefined();
        expect(loader.state.loadError).toEqual({
          message: 'Failed to load home dashboard',
          messageId: undefined,
          status: 500,
        });
      });

      it('should not transform v2 custom home dashboard spec', async () => {
        setBackendSrv({
          get: () =>
            Promise.resolve({
              dashboard: customHomeDashboardV2Spec,
              meta: {
                canSave: false,
                canEdit: true,
                canAdmin: false,
                canStar: false,
                canDelete: false,
                slug: '',
                url: '',
                expires: '0001-01-01T00:00:00Z',
                created: '0001-01-01T00:00:00Z',
                updated: '0001-01-01T00:00:00Z',
                updatedBy: '',
                createdBy: '',
                version: 0,
                hasAcl: false,
                isFolder: false,
                folderId: 0,
                folderUid: '',
                folderTitle: 'General',
                folderUrl: '',
                provisioned: false,
                provisionedExternalId: '',
                annotationsPermissions: null,
              },
            }),
        } as unknown as BackendSrv);

        const loader = new DashboardScenePageStateManagerV2({});
        await loader.loadDashboard({ uid: '', route: DashboardRoutes.Home });

        expect(loader.state.dashboard?.getInitialSaveModel()).toEqual(customHomeDashboardV2Spec);
        expect(loader.state.loadError).toBeUndefined();
      });
    });

    describe('New dashboards', () => {
      it('Should have new empty model and should not be cached', async () => {
        const loader = new DashboardScenePageStateManagerV2({});

        await loader.loadDashboard({ uid: '', route: DashboardRoutes.New });
        const dashboard = loader.state.dashboard!;

        expect(dashboard.state.isEditing).toBe(undefined);
        expect(dashboard.state.isDirty).toBe(false);

        dashboard.setState({ title: 'Changed' });

        await loader.loadDashboard({ uid: '', route: DashboardRoutes.New });
        const dashboard2 = loader.state.dashboard!;

        expect(dashboard2.state.title).toBe('New dashboard');
      });
    });

    describe('caching', () => {
      it('should take scene from cache if it exists', async () => {
        const getDashSpy = jest.fn();
        setupDashboardAPI(
          {
            access: {},
            apiVersion: 'v2alpha1',
            kind: 'DashboardWithAccessInfo',
            metadata: {
              name: 'fake-dash',
              creationTimestamp: '',
              resourceVersion: '1',
            },
            spec: { ...defaultDashboardV2Spec() },
          },
          getDashSpy
        );

        const loader = new DashboardScenePageStateManagerV2({});

        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        loader.state.dashboard?.onEnterEditMode();

        expect(loader.state.dashboard?.state.isEditing).toBe(true);

        loader.clearState();

        // now load it again
        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        // should still be editing
        expect(loader.state.dashboard?.state.isEditing).toBe(true);
        expect(loader.state.dashboard?.state.version).toBe(1);

        loader.clearState();

        loader.setDashboardCache('fake-dash', {
          access: {},
          apiVersion: 'v2alpha1',
          kind: 'DashboardWithAccessInfo',
          metadata: {
            name: 'fake-dash',
            creationTimestamp: '',
            resourceVersion: '2',
          },
          spec: { ...defaultDashboardV2Spec() },
        });

        // now load a third time
        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        expect(loader.state.dashboard!.state.isEditing).toBe(undefined);
        expect(loader.state.dashboard!.state.version).toBe(2);
      });

      it('should cache the dashboard DTO', async () => {
        const getDashSpy = jest.fn();
        setupDashboardAPI(
          {
            access: {},
            apiVersion: 'v2alpha1',
            kind: 'DashboardWithAccessInfo',
            metadata: {
              name: 'fake-dash',
              creationTimestamp: '',
              resourceVersion: '1',
            },
            spec: { ...defaultDashboardV2Spec() },
          },
          getDashSpy
        );

        const loader = new DashboardScenePageStateManagerV2({});

        expect(loader.getDashboardFromCache('fake-dash')).toBeNull();

        await loader.loadDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });

        expect(loader.getDashboardFromCache('fake-dash')).toBeDefined();
      });

      it('should load dashboard DTO from cache if requested again within 2s', async () => {
        const getDashSpy = jest.fn();
        setupDashboardAPI(
          {
            access: {},
            apiVersion: 'v2alpha1',
            kind: 'DashboardWithAccessInfo',
            metadata: {
              name: 'fake-dash',
              creationTimestamp: '',
              resourceVersion: '1',
            },
            spec: { ...defaultDashboardV2Spec() },
          },
          getDashSpy
        );

        const loader = new DashboardScenePageStateManagerV2({});

        expect(loader.getDashboardFromCache('fake-dash')).toBeNull();

        await loader.fetchDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
        expect(getDashSpy).toHaveBeenCalledTimes(1);

        advanceBy(DASHBOARD_CACHE_TTL / 2);
        await loader.fetchDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
        expect(getDashSpy).toHaveBeenCalledTimes(1);

        advanceBy(DASHBOARD_CACHE_TTL / 2 + 1);
        await loader.fetchDashboard({ uid: 'fake-dash', route: DashboardRoutes.Normal });
        expect(getDashSpy).toHaveBeenCalledTimes(2);
      });
    });
  });
});

const customHomeDashboardV2Spec = {
  title: 'Home Dashboard v2 schema',
  cursorSync: 'Off',
  preload: false,
  editable: true,
  links: [],
  tags: [],
  timeSettings: {
    timezone: 'browser',
    from: 'now-6h',
    to: 'now',
    autoRefresh: '',
    autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
    hideTimepicker: false,
    fiscalYearStartMonth: 0,
  },
  variables: [],
  elements: {
    text_panel: {
      kind: 'Panel',
      spec: {
        id: 0,
        title: 'Welcome',
        description: 'Welcome to the home dashboard!',
        links: [],
        data: {
          kind: 'QueryGroup',
          spec: {
            queries: [],
            transformations: [],
            queryOptions: {},
          },
        },
        vizConfig: {
          kind: 'text',
          spec: {
            pluginVersion: '',
            options: {
              mode: 'markdown',
              content: '# Welcome to the home dashboard!\n\n## Example of v2 schema home dashboard',
            },
            fieldConfig: {
              defaults: {},
              overrides: [],
            },
          },
        },
      },
    },
  },
  annotations: [],
  layout: {
    kind: 'GridLayout',
    spec: {
      items: [
        {
          kind: 'GridLayoutItem',
          spec: {
            x: 6,
            y: 0,
            width: 12,
            height: 6,
            element: {
              kind: 'ElementReference',
              name: 'text_panel',
            },
          },
        },
      ],
    },
  },
};
