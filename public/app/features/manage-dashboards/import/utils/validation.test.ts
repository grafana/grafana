import {
  type Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { AnnoKeyFolder, AnnoKeyFolderTitle } from 'app/features/apiserver/types';
import { setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { type DashboardDTO } from 'app/types/dashboard';

import { validateDashboardJson, validateUid } from './validation';

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

describe('validateDashboardJson', () => {
  it('accepts a tag of exactly 255 UTF-8 bytes', () => {
    const json = JSON.stringify({ tags: ['a'.repeat(255)] });
    expect(validateDashboardJson(json)).toBe(true);
  });

  it('rejects a tag over 255 UTF-8 bytes', () => {
    const json = JSON.stringify({ tags: ['a'.repeat(256)] });
    expect(validateDashboardJson(json)).toBe('Dashboard tag too long, max 255 UTF-8 bytes');
  });

  it('rejects a multi-byte tag that exceeds 255 UTF-8 bytes', () => {
    // 128 Cyrillic 'б' (2 bytes each) = 256 bytes
    const json = JSON.stringify({ tags: ['б'.repeat(128)] });
    expect(validateDashboardJson(json)).toBe('Dashboard tag too long, max 255 UTF-8 bytes');
  });
});

describe('validateUid', () => {
  beforeAll(() => {
    setDashboardAPI({
      unified: {
        getDashboardDTO: jest.fn().mockResolvedValue(legacyDashboard),
        deleteDashboard: jest.fn(),
        saveDashboard: jest.fn(),
        listDeletedDashboards: jest.fn(),
        getDeletedDashboard: jest.fn(),
        restoreDashboard: jest.fn(),
        getDashboard: jest.fn(),
        listDashboardHistory: jest.fn(),
        getDashboardHistoryVersions: jest.fn(),
        restoreDashboardVersion: jest.fn(),
      },
      v2: {
        getDashboardDTO: jest.fn().mockResolvedValue(v2Dashboard),
        deleteDashboard: jest.fn(),
        saveDashboard: jest.fn(),
        listDeletedDashboards: jest.fn(),
        getDeletedDashboard: jest.fn(),
        restoreDashboard: jest.fn(),
        getDashboard: jest.fn(),
        listDashboardHistory: jest.fn(),
        getDashboardHistoryVersions: jest.fn(),
        restoreDashboardVersion: jest.fn(),
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
