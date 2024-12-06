import { act, screen, waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom-v5-compat';
import { Props } from 'react-virtualized-auto-sizer';
import { render } from 'test/test-utils';

import { config, locationService } from '@grafana/runtime';
import {
  HOME_DASHBOARD_CACHE_KEY,
  getDashboardScenePageStateManager,
} from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardDataDTO, DashboardRoutes } from 'app/types';

import { DashboardWithAccessInfo } from '../api/types';

import DashboardPageProxy, { DashboardPageProxyProps } from './DashboardPageProxy';

const dashMock: DashboardWithAccessInfo<DashboardDataDTO> = {
  apiVersion: 'legacy',
  kind: 'DashboardWithAccessInfo',
  metadata: {
    name: 'uid',
    resourceVersion: '1',
    creationTimestamp: '1',  
  },
  spec: {
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
  access: {
    canEdit: false,
  },
};

const homeMock: DashboardWithAccessInfo<DashboardDataDTO>  = {
  ...dashMock,
  spec: {
    ...dashMock.spec,
    uid: '',
    title: 'Home',
  },
};

const homeMockEditable: DashboardWithAccessInfo<DashboardDataDTO>  = {
  ...homeMock,
  access: {
    ...homeMock.access,
    canEdit: true,
  },
};

const dashMockEditable: DashboardWithAccessInfo<DashboardDataDTO>  = {
  ...dashMock,
  access: {
    ...dashMock.access,
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

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    getDashboardDTO: jest.fn().mockResolvedValue(dashMock),
  }),
}));

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
});
