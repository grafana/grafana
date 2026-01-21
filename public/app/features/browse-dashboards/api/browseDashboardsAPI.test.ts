import { configureStore } from '@reduxjs/toolkit';

import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';

import { browseDashboardsAPI } from './browseDashboardsAPI';

const mockGet = jest.fn().mockResolvedValue({});
const mockPut = jest.fn().mockResolvedValue({});
const mockPost = jest.fn().mockResolvedValue({});

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: mockGet,
    put: mockPut,
    post: mockPost,
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {
      version: '11.5.0-test-version-string',
    },
  },
}));

describe('browseDashboardsAPI saveDashboard', () => {
  const getDashboardAPIMock = jest.mocked(getDashboardAPI);
  const createTestStore = () =>
    configureStore({
      reducer: {
        [browseDashboardsAPI.reducerPath]: browseDashboardsAPI.reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(browseDashboardsAPI.middleware),
    });

  beforeEach(() => {
    getDashboardAPIMock.mockReset();
  });

  const createMockDashboardAPI = (saveDashboard: jest.Mock) =>
    ({ saveDashboard } as unknown as ReturnType<typeof getDashboardAPI>);

  it('uses v1 dashboard API for v1 dashboards', async () => {
    const saveDashboardV1 = jest.fn().mockResolvedValue({ uid: 'test-uid-v1' });
    const saveDashboardV2 = jest.fn().mockResolvedValue({ uid: 'test-uid-v2' });

    getDashboardAPIMock.mockImplementation((version?: 'v1' | 'v2') => {
      if (version === 'v1') {
        return createMockDashboardAPI(saveDashboardV1);
      }
      if (version === 'v2') {
        return createMockDashboardAPI(saveDashboardV2);
      }
      return createMockDashboardAPI(jest.fn());
    });

    const cmd: SaveDashboardCommand<Dashboard> = {
      dashboard: { title: 'V1', panels: [], schemaVersion: 1 } as unknown as Dashboard,
      folderUid: 'folder-1',
    };

    const store = createTestStore();
    await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

    expect(getDashboardAPIMock).toHaveBeenCalledWith('v1');
    expect(saveDashboardV1).toHaveBeenCalledWith(cmd);
    expect(saveDashboardV2).not.toHaveBeenCalled();
  });

  it('uses v2 dashboard API for v2 dashboards', async () => {
    const saveDashboardV1 = jest.fn().mockResolvedValue({ uid: 'test-uid-v1' });
    const saveDashboardV2 = jest.fn().mockResolvedValue({ uid: 'test-uid-v2' });

    getDashboardAPIMock.mockImplementation((version?: 'v1' | 'v2') => {
      if (version === 'v1') {
        return createMockDashboardAPI(saveDashboardV1);
      }
      if (version === 'v2') {
        return createMockDashboardAPI(saveDashboardV2);
      }
      return createMockDashboardAPI(jest.fn());
    });

    const v2Dashboard: DashboardV2Spec = { title: 'V2', elements: [] } as unknown as DashboardV2Spec;
    const cmd: SaveDashboardCommand<DashboardV2Spec> = {
      dashboard: v2Dashboard,
      folderUid: 'folder-2',
    };

    const store = createTestStore();
    await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

    expect(getDashboardAPIMock).toHaveBeenCalledWith('v2');
    expect(saveDashboardV2).toHaveBeenCalledWith(cmd);
    expect(saveDashboardV1).not.toHaveBeenCalled();
  });
});
