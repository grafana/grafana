import { RawTimeRange } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { getOtelResources, totalOtelResources, isOtelStandardization, getDeploymentEnvironments } from './api';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

describe('OTEL API', () => {
  const dataSourceUid = 'test-uid';
  const timeRange: RawTimeRange = {
    from: 'now-1h',
    to: 'now',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOtelResources', () => {
    it('should fetch and filter OTEL resources', async () => {
      const mockResponse = {
        data: ['job', 'instance', 'deployment_environment'],
      };
      (getBackendSrv().get as jest.Mock).mockResolvedValue(mockResponse);

      const resources = await getOtelResources(dataSourceUid, timeRange);

      expect(getBackendSrv().get).toHaveBeenCalledWith(
        `/api/datasources/uid/${dataSourceUid}/resources/api/v1/labels`,
        expect.any(Object),
        'explore-metrics-otel-resources'
      );
      expect(resources).toEqual(['job', 'instance']);
    });
  });

  describe('totalOtelResources', () => {
    it('should fetch total OTEL resources', async () => {
      const mockResponse = {
        data: {
          result: [
            { metric: { job: 'job1', instance: 'instance1' } },
            { metric: { job: 'job2', instance: 'instance2' } },
          ],
        },
      };
      (getBackendSrv().get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await totalOtelResources(dataSourceUid, timeRange);

      expect(getBackendSrv().get).toHaveBeenCalledWith(
        `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`,
        expect.any(Object),
        'explore-metrics-otel-check-total'
      );
      expect(result).toEqual({
        job: '"job1|job2"',
        instance: '"instance1|instance2"',
      });
    });
  });

  describe('isOtelStandardization', () => {
    it('should check if OTEL standardization is met', async () => {
      const mockResponse = {
        data: {
          result: [],
        },
      };
      (getBackendSrv().get as jest.Mock).mockResolvedValue(mockResponse);

      const isStandard = await isOtelStandardization(dataSourceUid, timeRange);

      expect(getBackendSrv().get).toHaveBeenCalledWith(
        `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`,
        expect.any(Object),
        'explore-metrics-otel-check-standard'
      );
      expect(isStandard).toBe(true);
    });

    it('should return false if OTEL standardization is not met', async () => {
      const mockResponse = {
        data: {
          result: [{ metric: { job: 'job1', instance: 'instance1' } }],
        },
      };
      (getBackendSrv().get as jest.Mock).mockResolvedValue(mockResponse);

      const isStandard = await isOtelStandardization(dataSourceUid, timeRange);

      expect(getBackendSrv().get).toHaveBeenCalledWith(
        `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`,
        expect.any(Object),
        'explore-metrics-otel-check-standard'
      );
      expect(isStandard).toBe(false);
    });
  });

  describe('getDeploymentEnvironments', () => {
    it('should fetch deployment environments', async () => {
      const mockResponse = {
        data: ['env1', 'env2'],
      };
      (getBackendSrv().get as jest.Mock).mockResolvedValue(mockResponse);

      const environments = await getDeploymentEnvironments(dataSourceUid, timeRange);

      expect(getBackendSrv().get).toHaveBeenCalledWith(
        `/api/datasources/uid/${dataSourceUid}/resources/api/v1/label/deployment_environment/values`,
        expect.any(Object),
        'explore-metrics-otel-resources-deployment-env'
      );
      expect(environments).toEqual(['env1', 'env2']);
    });
  });
});
