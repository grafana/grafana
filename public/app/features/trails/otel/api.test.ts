import { RawTimeRange } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { getOtelResources, totalOtelResources, isOtelStandardization, getDeploymentEnvironments } from './api';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => {
    return {
      get: (
        url: string,
        params?: Record<string, string | number>,
        requestId?: string,
        options?: Partial<BackendSrvRequest>
      ) => {
        if (requestId === 'explore-metrics-otel-resources') {
          return Promise.resolve({ data: ['job', 'instance', 'deployment_environment'] });
        } else if (requestId === 'explore-metrics-otel-check-total') {
          return Promise.resolve({
            data: {
              result: [
                { metric: { job: 'job1', instance: 'instance1' } },
                { metric: { job: 'job2', instance: 'instance2' } },
              ],
            },
          });
        } else if (requestId === 'explore-metrics-otel-check-standard') {
          return Promise.resolve({
            data: {
              result: [{ metric: { job: 'job1', instance: 'instance1' } }],
            },
          });
        } else if (requestId === 'explore-metrics-otel-resources-deployment-env') {
          return Promise.resolve({ data: ['env1', 'env2'] });
        }
        return [];
      },
    };
  },
}));

describe('OTEL API', () => {
  const dataSourceUid = 'test-uid';
  const timeRange: RawTimeRange = {
    from: 'now-1h',
    to: 'now',
  };

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('getOtelResources', () => {
    it('should fetch and filter OTEL resources', async () => {
      const resources = await getOtelResources(dataSourceUid, timeRange);

      expect(resources).toEqual(['job', 'instance']);
    });
  });

  describe('totalOtelResources', () => {
    it('should fetch total OTEL resources', async () => {
      const result = await totalOtelResources(dataSourceUid, timeRange);

      expect(result).toEqual({
        jobs: ['job1', 'job2'],
        instances: ['instance1', 'instance2'],
      });
    });
  });

  describe('isOtelStandardization', () => {
    // keeping for reference because standardization for OTel by series on target_info for job&instance is not consistent
    // There is a bug currently where there is stale data in Prometheus resulting in duplicate series for job&instance at random times
    // When this is resolved, we can check for standardization again
    xit('should check if OTEL standardization is met when there are no duplicate series on target_info for job&instance', async () => {
      // will return duplicates, see mock above
      const isStandard = await isOtelStandardization(dataSourceUid, timeRange);

      expect(isStandard).toBe(false);
    });
  });

  describe('getDeploymentEnvironments', () => {
    it('should fetch deployment environments', async () => {
      const environments = await getDeploymentEnvironments(dataSourceUid, timeRange, []);

      expect(environments).toEqual(['env1', 'env2']);
    });
  });
});
