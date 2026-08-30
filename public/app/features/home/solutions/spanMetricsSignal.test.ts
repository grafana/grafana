import { createDataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';

import { runInstantQueries } from './promQuery';
import { probeFound, SPAN_METRICS_PROBE } from './solutionDataProbes';
import { probeSpanMetrics } from './spanMetricsSignal';

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runInstantQueries: jest.fn(),
}));

jest.mock('./solutionDataProbes', () => ({
  ...jest.requireActual('./solutionDataProbes'),
  probeFound: jest.fn(),
}));

const runInstantQueriesMock = jest.mocked(runInstantQueries);
const probeFoundMock = jest.mocked(probeFound);

const datasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

beforeEach(() => {
  runInstantQueriesMock.mockReset();
  probeFoundMock.mockReset();
  probeFoundMock.mockImplementation(async (_type, hasData) => ((await hasData(datasource)) ? datasource : null));
});

it('returns the Prometheus datasource whose span-metrics query finds data', async () => {
  runInstantQueriesMock.mockResolvedValue([
    createDataFrame({ refId: 'probe', fields: [{ name: 'Value', type: FieldType.number, values: [3] }] }),
  ]);

  await expect(probeSpanMetrics()).resolves.toBe(datasource);
  expect(runInstantQueriesMock).toHaveBeenCalledWith({ probe: SPAN_METRICS_PROBE }, datasource, expect.any(Number));
});

it('returns null when no span-metrics series exists', async () => {
  runInstantQueriesMock.mockResolvedValue([]);

  await expect(probeSpanMetrics()).resolves.toBeNull();
});
