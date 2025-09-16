import {
  Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { AnnoKeyFolder, AnnoKeyFolderTitle } from 'app/features/apiserver/types';
import { setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDTO } from 'app/types/dashboard';

import { validateUid } from './validation';

const legacyDashboard: DashboardDTO = {
  dashboard: {
    title: 'Legacy Dashboard',
    schemaVersion: 16,
    uid: 'dashboard-uid',
  },
  meta: {
    folderTitle: 'Folder title',
    folderUid: 'folder-uid',
  },
};

const v2Dashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
  kind: 'DashboardWithAccessInfo',
  apiVersion: 'v2beta1',
  metadata: {
    creationTimestamp: '2021-09-29T14:00:00Z',
    name: 'dashboard-uid',
    resourceVersion: '1',
    annotations: {
      [AnnoKeyFolder]: 'folder-uid',
      [AnnoKeyFolderTitle]: 'folder-title',
    },
  },
  access: {},
  spec: {
    ...defaultDashboardV2Spec(),
    title: 'V2 Dashboard',
  },
};

describe('validateUid', () => {
  beforeAll(() => {
    setDashboardAPI({
      legacy: {
        getDashboardDTO: jest.fn().mockResolvedValue(legacyDashboard),
        deleteDashboard: jest.fn(),
        saveDashboard: jest.fn(),
        listDeletedDashboards: jest.fn(),
        restoreDashboard: jest.fn(),
      },
      v2: {
        getDashboardDTO: jest.fn().mockResolvedValue(v2Dashboard),
        deleteDashboard: jest.fn(),
        saveDashboard: jest.fn(),
        listDeletedDashboards: jest.fn(),
        restoreDashboard: jest.fn(),
      },
    });
  });
  describe('Dashboards API v1', () => {
    it('should return a message with the existing dashboard title and folder title', async () => {
      const result = await validateUid('dashboard-uid');
      expect(result).toBe(`Dashboard named 'Legacy Dashboard' in folder 'Folder title' has the same UID`);
    });
  });
});
