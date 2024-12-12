import { RawTimeRange } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import {
  getOtelResources,
  totalOtelResources,
  isOtelStandardization,
  getDeploymentEnvironments,
  getFilteredResourceAttributes,
} from './api';

jest.mock('./util', () => ({
  ...jest.requireActual('./util'),
  limitOtelMatchTerms: jest.fn().mockImplementation(() => {
    return {
      jobsRegex: 'job=~"job1|job2"',
      instancesRegex: 'instance=~"instance1|instance2"',
      // this flag is used when the values exceed 2000 characters
      // in this mock we are not including more, just flipping the flag
      missingOtelTargets: true,
    };
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    publicDashboardAccessToken: '123',
  },
  getBackendSrv: () => {
    return {
      get: (
        url: string,
        params?: Record<string, string | number>,
        requestId?: string,
        options?: Partial<BackendSrvRequest>
      ) => {
        // explore-metrics-otel-resources
        if (requestId === 'explore-metrics-otel-resources') {
          return Promise.resolve({ data: ['job', 'instance', 'deployment_environment'] });
        } else if (
          requestId === 'explore-metrics-otel-check-total-count(target_info{}) by (job, instance)' ||
          requestId === 'explore-metrics-otel-check-total-count(metric) by (job, instance)'
        ) {
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
        } else if (
          requestId ===
          'explore-metrics-otel-resources-metric-job-instance-metric{job=~"job1|job2",instance=~"instance1|instance2"}'
        ) {
          // part of getFilteredResourceAttributes to get metric labels. We prioritize metric labels over resource attributes so we use these to filter
          return Promise.resolve({ data: ['promotedResourceAttribute'] });
        } else if (
          requestId ===
          'explore-metrics-otel-resources-metric-job-instance-target_info{job=~"job1|job2",instance=~"instance1|instance2"}'
        ) {
          // part of getFilteredResourceAttributes to get instance labels
          return Promise.resolve({ data: ['promotedResourceAttribute', 'resourceAttribute'] });
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

  afterEach(() => {
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

  describe('getFilteredResourceAttributes', () => {
    it('should fetch and filter OTEL resources with excluded filters', async () => {
      const { attributes } = await getFilteredResourceAttributes(dataSourceUid, timeRange, 'metric', ['job']);
      // promotedResourceAttribute will be filtered out because even though it is a resource attribute, it is also a metric label and wee prioritize metric labels
      expect(attributes).not.toEqual(['promotedResourceAttribute', 'resourceAttribute']);
      // the resource attributes returned are the ones only present on target_info
      expect(attributes).toEqual(['resourceAttribute']);
    });

    it('should return a boolean true if the job and instance list for matching is truncated', async () => {
      const { missingOtelTargets } = await getFilteredResourceAttributes(dataSourceUid, timeRange, 'metric', ['job']);
      expect(missingOtelTargets).toBe(true);
    });
  });
});
