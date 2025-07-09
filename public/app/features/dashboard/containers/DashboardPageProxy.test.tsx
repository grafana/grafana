import { act, screen, waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom-v5-compat';
import { Props } from 'react-virtualized-auto-sizer';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import {
  HOME_DASHBOARD_CACHE_KEY,
  getDashboardScenePageStateManager,
} from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import {
  setupLoadDashboardMockReject,
  setupLoadDashboardRuntimeErrorMock,
} from 'app/features/dashboard-scene/utils/test-utils';
import { DashboardDTO, DashboardRoutes } from 'app/types/dashboard';

import { DashboardLoaderSrv, setDashboardLoaderSrv } from '../services/DashboardLoaderSrv';

import DashboardPageProxy, { DashboardPageProxyProps } from './DashboardPageProxy';

const dashMock: DashboardDTO = {
  dashboard: {
    id: 1,
    annotations: {
      list: [],
    },
    uid: 'uid',
    title: 'title',
    panels: [],
    version: 1,
    schemaVersion: 1,
  },
  meta: {
    canEdit: false,
    created: 'Friday, 4 July 2025 07:56:41 GMT+05:30',
  },
};

const homeMock = {
  ...dashMock,
  dashboard: {
    ...dashMock.dashboard,
    uid: '',
    title: 'Home',
  },
};

const homeMockEditable = {
  ...homeMock,
  meta: {
    ...homeMock.meta,
    canEdit: true,
  },
};

const dashMockEditable = {
  ...dashMock,
  meta: {
    ...dashMock.meta,
    canEdit: true,
  },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    getInstanceSettings: () => {
      return { name: 'Grafana' };
    },
    get: jest.fn().mockResolvedValue({}),
  }),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({ dashboard: {}, meta: { url: '' } }),
    };
  },
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 1,
      scaledHeight: 1,
      scaledWidth: 1,
      width: 1,
    });
});

setDashboardLoaderSrv({
  loadDashboard: jest.fn().mockResolvedValue(dashMock),
  // disabling type checks since this is a test util
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
} as unknown as DashboardLoaderSrv);

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn().mockReturnValue({}),
}));

function setup(props: Partial<DashboardPageProxyProps> & { uid?: string }) {
  (useParams as jest.Mock).mockReturnValue({ uid: props.uid });
  return render(
    <DashboardPageProxy
      location={locationService.getLocation()}
      queryParams={{}}
      route={{ routeName: DashboardRoutes.Home, component: () => null, path: '/' }}
      {...props}
    />
  );
}

describe('DashboardPageProxy', () => {
  describe('when dashboardSceneForViewers feature toggle disabled', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      config.featureToggles.dashboardSceneForViewers = false;
    });

    it('home dashboard', async () => {
      getDashboardScenePageStateManager().setDashboardCache(HOME_DASHBOARD_CACHE_KEY, dashMock);
      act(() => {
        setup({
          route: { routeName: DashboardRoutes.Home, component: () => null, path: '/' },
        });
      });

      await waitFor(() => {
        expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(0);
      });
    });

    it('uid dashboard', async () => {
      getDashboardScenePageStateManager().setDashboardCache('abc-def', dashMock);

      act(() => {
        setup({
          route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' },
          uid: 'abc-def',
        });
      });

      await waitFor(() => {
        expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(0);
      });
    });
  });

  describe('when dashboardSceneForViewers feature toggle enabled', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      config.featureToggles.dashboardSceneForViewers = true;
    });

    describe('when user can edit a dashboard ', () => {
      it('should not render DashboardScenePage if route is Home', async () => {
        getDashboardScenePageStateManager().setDashboardCache(HOME_DASHBOARD_CACHE_KEY, homeMockEditable);
        act(() => {
          setup({
            route: { routeName: DashboardRoutes.Home, component: () => null, path: '/' },
            uid: '',
          });
        });

        await waitFor(() => {
          expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(0);
        });
      });

      it('should not render DashboardScenePage if route is Normal and has uid', async () => {
        getDashboardScenePageStateManager().setDashboardCache('abc-def', dashMockEditable);
        act(() => {
          setup({
            route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' },
            uid: 'abc-def',
          });
        });
        await waitFor(() => {
          expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(0);
        });
      });
    });

    describe('when user can only view a dashboard ', () => {
      it('should render DashboardScenePage if route is Home', async () => {
        getDashboardScenePageStateManager().setDashboardCache(HOME_DASHBOARD_CACHE_KEY, homeMock);
        act(() => {
          setup({
            route: { routeName: DashboardRoutes.Home, component: () => null, path: '/' },
            uid: '',
          });
        });

        await waitFor(() => {
          expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(1);
        });
      });

      it('should render DashboardScenePage if route is Normal and has uid', async () => {
        getDashboardScenePageStateManager().setDashboardCache('uid', dashMock);
        act(() => {
          setup({
            route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' },
            uid: 'uid',
          });
        });
        await waitFor(() => {
          expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(1);
        });
      });

      it('should render not DashboardScenePage if dashboard UID does not match route UID', async () => {
        getDashboardScenePageStateManager().setDashboardCache('uid', dashMock);
        act(() => {
          setup({
            route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' },
            uid: 'wrongUID',
          });
        });
        await waitFor(() => {
          expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(0);
        });
      });
    });
  });

  describe('errors rendering', () => {
    it('should render dashboard not found notice when dashboard... not found', async () => {
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

      setup({ route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' }, uid: 'abc' });

      expect(await screen.findByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
    });

    it('should render error alert for backend errors', async () => {
      setupLoadDashboardMockReject({
        status: 500,
        statusText: 'internal server error',
        data: {
          message: 'Internal server error',
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

      setup({ route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' }, uid: 'abc' });

      expect(await screen.findByTestId('dashboard-page-error')).toBeInTheDocument();
      expect(await screen.findByTestId('dashboard-page-error')).toHaveTextContent('Internal server error');
    });
    it('should render error alert for runtime errors', async () => {
      setupLoadDashboardRuntimeErrorMock();

      setup({ route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' }, uid: 'abc' });

      expect(await screen.findByTestId('dashboard-page-error')).toBeInTheDocument();
      expect(await screen.findByTestId('dashboard-page-error')).toHaveTextContent('Runtime error');
    });
  });
});
