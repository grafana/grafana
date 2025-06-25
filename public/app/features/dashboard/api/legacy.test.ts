import { UrlQueryMap } from '@grafana/data';
import { DashboardDTO } from 'app/types';

import { LegacyDashboardAPI } from './legacy';

const mockDashboardDto: DashboardDTO = {
  meta: {
    isFolder: false,
  },
  dashboard: {
    title: 'test',
    uid: 'test',
    schemaVersion: 0,
  },
};

const backendSrvGetSpy = jest.fn();
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    get: (dashUrl: string, params: Object) => {
      backendSrvGetSpy(dashUrl, params);
      const uid = dashUrl.split('/').pop();
      if (uid === 'folderUid') {
        return Promise.resolve({
          meta: {
            isFolder: true,
          },
        });
      }

      return mockDashboardDto;
    },
  }),
}));

jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  ignoreNextSave: jest.fn(),
}));

describe('Legacy dashboard API', () => {
  it('should throw an error if requesting a folder', async () => {
    const api = new LegacyDashboardAPI();

    await expect(api.getDashboardDTO('folderUid')).rejects.toMatchObject({
      status: 404,
      config: { url: `/api/dashboards/uid/folderUid` },
      data: { message: 'Dashboard not found' },
    });
  });

  it('should return a valid dashboard', async () => {
    const api = new LegacyDashboardAPI();
    const params: UrlQueryMap = {
      param: 1,
    };
    const result = await api.getDashboardDTO('validUid', params);
    expect(result).toEqual(mockDashboardDto);
    expect(backendSrvGetSpy).toHaveBeenLastCalledWith('/api/dashboards/uid/validUid', params);
  });
});
