import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { backendSrv } from 'app/core/services/backend_srv';
import { AnnoKeyFolder, AnnoKeyFolderId, AnnoKeyFolderTitle, AnnoKeyFolderUrl } from 'app/features/apiserver/types';

import { DashboardWithAccessInfo } from './types';
import { K8sDashboardV2API } from './v2';

const mockDashboardDto: DashboardWithAccessInfo<DashboardV2Spec> = {
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
    ...defaultDashboardV2Spec(),
  },
  access: {},
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: () => mockDashboardDto,
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
  },
}));

jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  ignoreNextSave: jest.fn(),
}));

describe('v2 dashboard API', () => {
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

    const convertToV1 = false;
    const api = new K8sDashboardV2API(convertToV1);
    // because the API can currently return both DashboardDTO and DashboardWithAccessInfo<DashboardV2Spec> based on the
    // parameter convertToV1, we need to cast the result to DashboardWithAccessInfo<DashboardV2Spec> to be able to
    // access
    const result = (await api.getDashboardDTO('test')) as DashboardWithAccessInfo<DashboardV2Spec>;
    expect(result.metadata.annotations![AnnoKeyFolderId]).toBe(1);
    expect(result.metadata.annotations![AnnoKeyFolderTitle]).toBe('New Folder');
    expect(result.metadata.annotations![AnnoKeyFolderUrl]).toBe('/folder/url');
    expect(result.metadata.annotations![AnnoKeyFolder]).toBe('new-folder');
  });
});
