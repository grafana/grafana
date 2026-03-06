import {
  Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { AnnoKeyFolder, AnnoKeyFolderTitle } from 'app/features/apiserver/types';
import { setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDTO } from 'app/types/dashboard';

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
  it('should reject invalid JSON', () => {
    expect(validateDashboardJson('not json')).toBe('Not valid JSON');
  });

  it('should reject empty JSON object', () => {
    expect(validateDashboardJson('{}')).toBe(
      'JSON does not appear to be a valid dashboard: missing required fields'
    );
  });

  it('should reject null', () => {
    expect(validateDashboardJson('null')).toBe('Dashboard JSON must be a JSON object');
  });

  it('should reject arrays', () => {
    expect(validateDashboardJson('[]')).toBe('Dashboard JSON must be a JSON object');
  });

  it('should reject primitive values', () => {
    expect(validateDashboardJson('"hello"')).toBe('Dashboard JSON must be a JSON object');
    expect(validateDashboardJson('42')).toBe('Dashboard JSON must be a JSON object');
  });

  it('should reject objects without dashboard fields', () => {
    expect(validateDashboardJson('{"foo": "bar"}')).toBe(
      'JSON does not appear to be a valid dashboard: missing required fields'
    );
  });

  it('should accept V1 dashboard with title', () => {
    expect(validateDashboardJson('{"title": "My Dashboard"}')).toBe(true);
  });

  it('should accept V1 dashboard with panels', () => {
    expect(validateDashboardJson('{"panels": []}')).toBe(true);
  });

  it('should accept V2 dashboard with elements', () => {
    expect(validateDashboardJson('{"elements": {}}')).toBe(true);
  });

  it('should accept legacy dashboard with rows', () => {
    expect(validateDashboardJson('{"rows": []}')).toBe(true);
  });

  it('should reject dashboard with invalid tags', () => {
    expect(validateDashboardJson('{"title": "test", "tags": [123]}')).toBe('tags expected array of strings');
  });

  it('should reject dashboard with non-array tags', () => {
    expect(validateDashboardJson('{"title": "test", "tags": "not-array"}')).toBe('tags expected array');
  });
});

describe('validateUid', () => {
  beforeAll(() => {
    setDashboardAPI({
      legacy: {
        getDashboardDTO: jest.fn().mockResolvedValue(legacyDashboard),
        deleteDashboard: jest.fn(),
        saveDashboard: jest.fn(),
        listDeletedDashboards: jest.fn(),
        restoreDashboard: jest.fn(),
        listDashboardHistory: jest.fn(),
        getDashboardHistoryVersions: jest.fn(),
        restoreDashboardVersion: jest.fn(),
      },
      v2: {
        getDashboardDTO: jest.fn().mockResolvedValue(v2Dashboard),
        deleteDashboard: jest.fn(),
        saveDashboard: jest.fn(),
        listDeletedDashboards: jest.fn(),
        restoreDashboard: jest.fn(),
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
