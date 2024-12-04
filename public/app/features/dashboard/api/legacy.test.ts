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
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    get: (dashUrl: string) => {
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
    expect(async () => await api.getDashboardDTO('folderUid')).rejects.toThrowError('Dashboard not found');
  });

  it('should return a valid dashboard', async () => {
    const api = new LegacyDashboardAPI();
    const result = await api.getDashboardDTO('validUid');
    expect(result).toEqual(mockDashboardDto);
  });
});
