import { AnnoKeyCreatedBy, AnnoKeyFolder, AnnoKeyFolderId, AnnoKeyFolderTitle, AnnoKeyFolderUrl, AnnoKeySlug, AnnoKeyUpdatedBy, AnnoKeyUpdatedTimestamp } from 'app/features/apiserver/types';
import { DashboardDTO } from 'app/types';

import { LegacyDashboardAPI } from './legacy';

const mockDashboardDto: DashboardDTO = {
  meta: {
    isFolder: false,
    createdBy: 'testCreatedBy',
    updatedBy: 'testCreatedBy',
    created: 'testCreated',
    updated: 'testUpdated',
    slug: 'testSlug',
    url: 'testUrl',
    folderId: 1,
    folderTitle: 'testFolderTitle',
    folderUid: 'testFolderUid',
    folderUrl: 'testFolderUrl',
    canAdmin: true,
    canDelete: true,
    canEdit: true,
    canSave: true,
    canShare: true,
    canStar: true,
    annotationsPermissions: {
      dashboard: {
        canAdd: true,
        canDelete: true,
        canEdit: true,
      },
      organization: {
        canAdd: true,
        canDelete: true,
        canEdit: true,
      },
    }
  },
  dashboard: {
    title: 'test',
    uid: 'validUid',
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

    expect(result).toEqual({
      kind: 'DashboardWithAccessInfo',
      apiVersion: 'legacy',
      metadata: {
        creationTimestamp: 'testCreated',
        name: 'validUid',
        resourceVersion: '0',
        annotations: {
          [AnnoKeyFolder]: 'testFolderUid',
          [AnnoKeyFolderTitle]: 'testFolderTitle',
          [AnnoKeyFolderUrl]: 'testFolderUrl',
          [AnnoKeyFolderId]: 1,
          [AnnoKeyCreatedBy]: 'testCreatedBy',
          [AnnoKeyUpdatedTimestamp]: 'testUpdated',
          [AnnoKeyUpdatedBy]: 'testCreatedBy',
          [AnnoKeySlug]: 'testSlug',
        },
      },
      spec: {
        title: 'test',
        uid: 'validUid',
        schemaVersion: 0,
      },
      access: {
        slug: 'testSlug',
        url: 'testUrl',
        canSave: true,
        canEdit: true,
        canDelete: true,
        canShare: true,
        canStar: true,
        canAdmin: true,
        annotationsPermissions: {
          dashboard: { canAdd: true, canEdit: true, canDelete: true },
          organization: { canAdd: true, canEdit: true, canDelete: true },
        },
      },
    });
  });
});
