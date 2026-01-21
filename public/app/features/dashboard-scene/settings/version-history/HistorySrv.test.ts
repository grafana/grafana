import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';

import { K8sHistorySrv, LegacyHistorySrv, createHistorySrv } from './HistorySrv';
import { restore, versions } from './mocks/dashboardHistoryMocks';

const getMock = jest.fn().mockResolvedValue({});
const postMock = jest.fn().mockResolvedValue({});
const putMock = jest.fn().mockResolvedValue({});

jest.mock('app/core/store', () => ({
  get: jest.fn(),
  getObject: jest.fn((_a, b) => b),
}));

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => ({
      post: postMock,
      get: getMock,
      put: putMock,
    }),
    config: {
      ...original.config,
      featureToggles: {
        kubernetesDashboardVersions: false,
      },
    },
  };
});

jest.mock('../../../../api/utils', () => ({
  getAPINamespace: () => 'default',
}));

describe('LegacyHistorySrv', () => {
  const versionsResponse = versions();
  const restoreResponse = restore;

  let historySrv = new LegacyHistorySrv();

  const dash = createDashboardModelFixture({ uid: '_U4zObQMz' });
  const emptyDash = createDashboardModelFixture();
  const historyListOpts = { limit: 10, start: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHistoryList', () => {
    it('should return a versions array for the given dashboard id', () => {
      getMock.mockImplementation(() => Promise.resolve(versionsResponse));
      historySrv = new LegacyHistorySrv();

      return historySrv.getHistoryList(dash.uid, historyListOpts).then((versions) => {
        expect(versions).toEqual(versionsResponse);
      });
    });

    it('should return an empty versions array when not given an id', () => {
      return historySrv.getHistoryList(emptyDash.uid, historyListOpts).then((result) => {
        expect(result).toEqual({ versions: [] });
      });
    });

    it('should return an empty versions array when not given a dashboard id', () => {
      return historySrv.getHistoryList(null as unknown as string, historyListOpts).then((result) => {
        expect(result).toEqual({ versions: [] });
      });
    });
  });

  describe('getDashboardVersion', () => {
    it('should return a version object for the given dashboard id and version', () => {
      getMock.mockImplementation(() => Promise.resolve(versionsResponse.versions[0]));
      historySrv = new LegacyHistorySrv();

      return historySrv.getDashboardVersion(dash.uid, 4).then((version) => {
        expect(version).toEqual(versionsResponse.versions[0]);
      });
    });

    it('should return an empty object when not given an id', async () => {
      historySrv = new LegacyHistorySrv();

      const rsp = await historySrv.getDashboardVersion(emptyDash.uid, 6);
      expect(rsp).toEqual({});
    });
  });

  describe('restoreDashboard', () => {
    it('should return a success response given valid parameters', () => {
      const version = 6;
      postMock.mockImplementation(() => Promise.resolve(restoreResponse(version)));
      historySrv = new LegacyHistorySrv();
      return historySrv.restoreDashboard(dash.uid, version).then((response) => {
        expect(response).toEqual(restoreResponse(version));
      });
    });

    it('should return an empty object when not given an id', async () => {
      historySrv = new LegacyHistorySrv();
      const rsp = await historySrv.restoreDashboard(emptyDash.uid, 6);
      expect(rsp).toEqual({});
    });
  });
});

describe('K8sHistorySrv', () => {
  let historySrv: K8sHistorySrv;

  const dash = createDashboardModelFixture({ uid: '_U4zObQMz' });
  const emptyDash = createDashboardModelFixture();
  const historyListOpts = { limit: 10, start: 0 };

  const k8sVersionsResponse = {
    items: [
      {
        metadata: {
          name: '_U4zObQMz',
          generation: 4,
          annotations: {
            'grafana.app/updatedTimestamp': '2023-01-01T00:00:00Z',
            'grafana.app/updatedBy': 'admin',
            'grafana.app/message': 'Test update',
          },
        },
        spec: { title: 'Test Dashboard' },
      },
      {
        metadata: {
          name: '_U4zObQMz',
          generation: 3,
          annotations: {
            'grafana.app/updatedTimestamp': '2022-12-31T00:00:00Z',
            'grafana.app/updatedBy': 'admin',
            'grafana.app/message': 'Previous update',
          },
        },
        spec: { title: 'Test Dashboard v3' },
      },
    ],
    metadata: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    historySrv = new K8sHistorySrv();
  });

  describe('getHistoryList', () => {
    it('should return a versions array for the given dashboard id', async () => {
      getMock.mockResolvedValue(k8sVersionsResponse);

      const result = await historySrv.getHistoryList(dash.uid, historyListOpts);

      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining('/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards')
      );
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining('labelSelector=grafana.app%2Fget-history%3Dtrue'));
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining(`fieldSelector=metadata.name%3D${dash.uid}`));
      expect(result).toHaveProperty('versions');
      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].version).toBe(4);
      expect(result.versions[0].createdBy).toBe('admin');
    });

    it('should return an empty versions array when not given an id', async () => {
      const result = await historySrv.getHistoryList(emptyDash.uid, historyListOpts);
      expect(result).toEqual({ versions: [] });
    });

    it('should return an empty versions array when not given a dashboard id', async () => {
      const result = await historySrv.getHistoryList(null as unknown as string, historyListOpts);
      expect(result).toEqual({ versions: [] });
    });

    it('should include continueToken in params when provided', async () => {
      getMock.mockResolvedValue({ items: [], metadata: {} });
      const opts = { ...historyListOpts, continueToken: 'abc123' };

      await historySrv.getHistoryList(dash.uid, opts);

      expect(getMock).toHaveBeenCalledWith(expect.stringContaining('continue=abc123'));
    });
  });

  describe('getDashboardVersion', () => {
    it('should return a version object for the given dashboard id and version', async () => {
      getMock.mockResolvedValue(k8sVersionsResponse);

      const result = await historySrv.getDashboardVersion(dash.uid, 4);

      expect(result).toMatchObject({
        version: 4,
        createdBy: 'admin',
        message: 'Test update',
      });
    });

    it('should return an empty object when version not found', async () => {
      getMock.mockResolvedValue(k8sVersionsResponse);

      const result = await historySrv.getDashboardVersion(dash.uid, 999);

      expect(result).toEqual({});
    });

    it('should return an empty object when not given an id', async () => {
      const rsp = await historySrv.getDashboardVersion(emptyDash.uid, 6);
      expect(rsp).toEqual({});
    });
  });

  describe('restoreDashboard', () => {
    it('should PUT the dashboard with the spec from the old version', async () => {
      const currentDashboard = {
        metadata: { name: '_U4zObQMz', generation: 5, annotations: {} },
        spec: { title: 'Current Dashboard' },
      };

      getMock
        .mockResolvedValueOnce(k8sVersionsResponse) // getDashboardVersion call
        .mockResolvedValueOnce(currentDashboard); // get current dashboard

      putMock.mockResolvedValue({ success: true });

      await historySrv.restoreDashboard(dash.uid, 4);

      expect(putMock).toHaveBeenCalledWith(
        expect.stringContaining('/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/_U4zObQMz'),
        expect.objectContaining({
          spec: { title: 'Test Dashboard' },
          metadata: expect.objectContaining({
            annotations: expect.objectContaining({
              'grafana.app/message': 'Restored from version 4',
            }),
          }),
        })
      );
    });

    it('should return an empty object when not given an id', async () => {
      const rsp = await historySrv.restoreDashboard(emptyDash.uid, 6);
      expect(rsp).toEqual({});
    });

    it('should throw an error when version is not found', async () => {
      getMock.mockResolvedValue({ items: [], metadata: {} });

      await expect(historySrv.restoreDashboard(dash.uid, 999)).rejects.toThrow(
        'Version 999 not found for dashboard _U4zObQMz'
      );
    });
  });

  describe('transformToRevisionsModel', () => {
    it('should handle missing annotations gracefully', async () => {
      const responseWithoutAnnotations = {
        items: [
          {
            metadata: {
              name: '_U4zObQMz',
              generation: 1,
            },
            spec: { title: 'Test Dashboard' },
          },
        ],
        metadata: {},
      };

      getMock.mockResolvedValue(responseWithoutAnnotations);

      const result = await historySrv.getHistoryList(dash.uid, historyListOpts);

      expect(result.versions).toHaveLength(1);
      expect(result.versions[0].createdBy).toBe('');
      expect(result.versions[0].message).toBe('');
      expect(result.versions[0].parentVersion).toBe(0); // generation 1 should have parentVersion 0
    });

    it('should correctly calculate parentVersion', async () => {
      getMock.mockResolvedValue(k8sVersionsResponse);

      const result = await historySrv.getHistoryList(dash.uid, historyListOpts);

      expect(result.versions[0].version).toBe(4);
      expect(result.versions[0].parentVersion).toBe(3);
      expect(result.versions[1].version).toBe(3);
      expect(result.versions[1].parentVersion).toBe(2);
    });

    it('should set created date from annotation', async () => {
      getMock.mockResolvedValue(k8sVersionsResponse);

      const result = await historySrv.getHistoryList(dash.uid, historyListOpts);

      expect(result.versions[0].created).toEqual(new Date('2023-01-01T00:00:00Z'));
    });

    it('should use current date when updatedTimestamp annotation is missing', async () => {
      const responseWithoutTimestamp = {
        items: [
          {
            metadata: {
              name: '_U4zObQMz',
              generation: 1,
              annotations: {
                'grafana.app/updatedBy': 'admin',
              },
            },
            spec: { title: 'Test Dashboard' },
          },
        ],
        metadata: {},
      };

      getMock.mockResolvedValue(responseWithoutTimestamp);

      const beforeTest = new Date();
      const result = await historySrv.getHistoryList(dash.uid, historyListOpts);
      const afterTest = new Date();

      // The created date should be between beforeTest and afterTest
      expect(result.versions[0].created.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
      expect(result.versions[0].created.getTime()).toBeLessThanOrEqual(afterTest.getTime());
    });
  });

  describe('pagination', () => {
    it('should return continueToken from response metadata', async () => {
      const responseWithContinue = {
        items: [
          {
            metadata: {
              name: '_U4zObQMz',
              generation: 1,
              annotations: {},
            },
            spec: { title: 'Test Dashboard' },
          },
        ],
        metadata: {
          continue: 'next-page-token',
        },
      };

      getMock.mockResolvedValue(responseWithContinue);

      const result = await historySrv.getHistoryList(dash.uid, historyListOpts);

      expect(result.continueToken).toBe('next-page-token');
    });

    it('should not include continueToken when not present in response', async () => {
      getMock.mockResolvedValue({ items: [], metadata: {} });

      const result = await historySrv.getHistoryList(dash.uid, historyListOpts);

      expect(result.continueToken).toBeUndefined();
    });
  });
});

describe('createHistorySrv', () => {
  it('should return LegacyHistorySrv when feature flag is disabled', () => {
    const srv = createHistorySrv();
    expect(srv).toBeInstanceOf(LegacyHistorySrv);
  });

  it('should return K8sHistorySrv when feature flag is enabled', () => {
    // Temporarily enable the feature flag
    const { config } = jest.requireMock('@grafana/runtime');
    const originalValue = config.featureToggles.kubernetesDashboardVersions;
    config.featureToggles.kubernetesDashboardVersions = true;

    const srv = createHistorySrv();
    expect(srv).toBeInstanceOf(K8sHistorySrv);

    // Restore the original value
    config.featureToggles.kubernetesDashboardVersions = originalValue;
  });
});
