import { createDataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { runDatasourceQueries, runInstantQueries } from './promQuery';
import { hasSolutionData, resetSolutionDataProbes } from './solutionDataProbes';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runInstantQueries: jest.fn(),
  runDatasourceQueries: jest.fn(),
}));

const mockList = jest.mocked(getDataSourceInstanceList);
const mockInstant = jest.mocked(runInstantQueries);
const mockQueries = jest.mocked(runDatasourceQueries);
const mockGet = jest.fn();

function datasource(type: string, name = `${type}-ds`): DataSourceInstanceListItem {
  return {
    uid: `${name}-uid`,
    name,
    type,
    meta: { id: type } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: false,
  };
}

function scalarFrame(refId: string, value: number) {
  return createDataFrame({
    refId,
    fields: [{ name: 'Value', type: FieldType.number, values: [value] }],
  });
}

beforeEach(() => {
  resetSolutionDataProbes();
  mockList.mockReset();
  mockInstant.mockReset();
  mockQueries.mockReset();
  mockGet.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ get: mockGet } as unknown as ReturnType<typeof getBackendSrv>);
});

describe('hasSolutionData', () => {
  it('reports no data for an unknown solution', async () => {
    await expect(hasSolutionData('some-other-app')).resolves.toBe(false);
  });

  describe('Prometheus-backed solutions', () => {
    it('reports no data when there is no Prometheus datasource', async () => {
      mockList.mockResolvedValue([]);

      await expect(hasSolutionData('grafana-synthetic-monitoring-app')).resolves.toBe(false);
      expect(mockInstant).not.toHaveBeenCalled();
    });

    it('reports data when a datasource has the solution metric', async () => {
      mockList.mockResolvedValue([datasource('prometheus')]);
      mockInstant.mockResolvedValue([scalarFrame('probe', 12)]);

      await expect(hasSolutionData('grafana-synthetic-monitoring-app')).resolves.toBe(true);
      expect(mockInstant).toHaveBeenCalledWith(
        { probe: 'count(last_over_time(sm_check_info[24h]))' },
        expect.objectContaining({ type: 'prometheus' }),
        expect.any(Number)
      );
    });

    it('reports no data when the metric is absent on every datasource', async () => {
      mockList.mockResolvedValue([datasource('prometheus', 'prom-a'), datasource('prometheus', 'prom-b')]);
      mockInstant.mockResolvedValue([]);

      await expect(hasSolutionData('grafana-app-observability-app')).resolves.toBe(false);
      expect(mockInstant).toHaveBeenCalledTimes(2);
    });

    it('caches the probe within the TTL window', async () => {
      mockList.mockResolvedValue([datasource('prometheus')]);
      mockInstant.mockResolvedValue([scalarFrame('probe', 1)]);

      await hasSolutionData('grafana-synthetic-monitoring-app');
      await hasSolutionData('grafana-synthetic-monitoring-app');

      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockInstant).toHaveBeenCalledTimes(1);
    });

    it('fails toward hiding the recommendation when every datasource probe errors', async () => {
      mockList.mockResolvedValue([datasource('prometheus', 'prom-a'), datasource('prometheus', 'prom-b')]);
      mockInstant.mockRejectedValue(new Error('query timeout'));

      await expect(hasSolutionData('grafana-synthetic-monitoring-app')).resolves.toBe(true);
    }, 15_000);

    it('reports data when one datasource errors but another has the metric', async () => {
      mockList.mockResolvedValue([datasource('prometheus', 'prom-a'), datasource('prometheus', 'prom-b')]);
      mockInstant.mockImplementation(async (_queries, ds) =>
        ds.uid === 'prom-a-uid' ? Promise.reject(new Error('403')) : [scalarFrame('probe', 7)]
      );

      await expect(hasSolutionData('grafana-synthetic-monitoring-app')).resolves.toBe(true);
    }, 15_000);

    it('settles no-data when one datasource errors and the rest probe clean and empty', async () => {
      mockList.mockResolvedValue([datasource('prometheus', 'prom-a'), datasource('prometheus', 'prom-b')]);
      mockInstant.mockImplementation(async (_queries, ds) =>
        ds.uid === 'prom-a-uid' ? Promise.reject(new Error('403')) : []
      );

      await expect(hasSolutionData('grafana-synthetic-monitoring-app')).resolves.toBe(false);
    }, 15_000);
  });

  describe('Hosted Traces', () => {
    it('reports data when a Tempo search returns a trace', async () => {
      mockList.mockResolvedValue([datasource('tempo')]);
      mockQueries.mockResolvedValue([
        createDataFrame({ refId: 'traces', fields: [{ name: 'traceID', type: FieldType.string, values: ['abc'] }] }),
      ]);

      await expect(hasSolutionData('grafana-exploretraces-app')).resolves.toBe(true);
    });

    it('reports no data when the Tempo search is empty', async () => {
      mockList.mockResolvedValue([datasource('tempo')]);
      mockQueries.mockResolvedValue([]);

      await expect(hasSolutionData('grafana-exploretraces-app')).resolves.toBe(false);
    });

    it('reports no data when there is no Tempo datasource', async () => {
      mockList.mockResolvedValue([]);

      await expect(hasSolutionData('grafana-exploretraces-app')).resolves.toBe(false);
      expect(mockQueries).not.toHaveBeenCalled();
    });
  });

  describe('Frontend Observability', () => {
    it('reports data when the Faro app lists a configured app through its proxy route', async () => {
      mockGet.mockResolvedValue([{ name: 'my-app' }]);

      await expect(hasSolutionData('grafana-kowalski-app')).resolves.toBe(true);
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/plugin-proxy/grafana-kowalski-app/api-proxy/api/v1/app')
      );
    });

    it('reports no data when the Faro app list is empty', async () => {
      mockGet.mockResolvedValue([]);

      await expect(hasSolutionData('grafana-kowalski-app')).resolves.toBe(false);
    });

    it('treats a non-array response as no data so the setup card still shows', async () => {
      mockGet.mockResolvedValue({ items: [{ name: 'my-app' }] });

      await expect(hasSolutionData('grafana-kowalski-app')).resolves.toBe(false);
    });

    it('fails toward hiding the recommendation when the registry is unreachable', async () => {
      mockGet.mockRejectedValue(new Error('api unavailable'));

      await expect(hasSolutionData('grafana-kowalski-app')).resolves.toBe(true);
    }, 15_000);
  });
});
