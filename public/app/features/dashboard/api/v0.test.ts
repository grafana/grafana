import { backendSrv } from 'app/core/services/backend_srv';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { DashboardDataDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';
import { K8sDashboardAPI } from './v0';

const mockDashboardDto: DashboardWithAccessInfo<DashboardDataDTO> = {
  kind: 'DashboardWithAccessInfo',
  apiVersion: 'v0alpha1',

  metadata: {
    name: 'dash-uid',
    resourceVersion: '1',
    creationTimestamp: '1',
    annotations: {
      [AnnoKeyFolder]: 'new-folder',
    },
  },
  spec: {
    title: 'test',
    uid: 'test',
    schemaVersion: 0,
  },
  access: {},
};

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    get: () => mockDashboardDto,
  }),
  config: {},
}));

jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  ignoreNextSave: jest.fn(),
}));

describe('v0 dashboard API', () => {
  it('should provide folder annotations', async () => {
    jest.spyOn(backendSrv, 'getFolderByUid').mockResolvedValue({
      id: 1,
      uid: 'new-folder',
      title: 'New Folder',
      url: '/folder/url',
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      created: '',
      createdBy: '',
      hasAcl: false,
      updated: '',
      updatedBy: '',
    });

    const api = new K8sDashboardAPI();
    const result = await api.getDashboardDTO('test');
    expect(result.meta.isFolder).toBe(false);
    expect(result.meta.folderId).toBe(1);
    expect(result.meta.folderTitle).toBe('New Folder');
    expect(result.meta.folderUrl).toBe('/folder/url');
    expect(result.meta.folderUid).toBe('new-folder');
  });
});
