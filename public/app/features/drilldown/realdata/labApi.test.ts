import { getBackendSrv } from '@grafana/runtime';

import { requireDataSource } from '../dataSources';

import { lokiInstant, lokiLabelVolumes, tempoTagValues } from './labApi';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('../dataSources', () => ({
  requireDataSource: jest.fn().mockResolvedValue('traces-uid'),
}));

const get = jest.fn();

beforeEach(() => {
  get.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);
});

describe('tempoTagValues', () => {
  it('asks the chosen traces data source for the values of the tag', async () => {
    get.mockResolvedValue({ tagValues: [{ type: 'string', value: 'checkout' }] });

    const values = await tempoTagValues('resource.service.name', 1000, 2000);

    expect(get).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/api/v2/search/tag/resource.service.name/values',
      { start: 1000, end: 2000 },
      undefined,
      { showErrorAlert: false }
    );
    expect(values).toEqual(['checkout']);
  });

  // Tempo's JSON leaves the value out of an entry whose value is an empty string, and an empty name names nothing.
  it.each([
    { entry: 'has no value', tagValue: { type: 'string' } },
    { entry: 'has a null value', tagValue: { type: 'string', value: null } },
    { entry: 'has an empty value', tagValue: { type: 'string', value: '' } },
  ])('leaves out an entry that $entry', async ({ tagValue }) => {
    get.mockResolvedValue({
      tagValues: [{ type: 'string', value: 'checkout' }, tagValue, { type: 'string', value: 'cart' }],
    });

    expect(await tempoTagValues('resource.service.name', 0, 1)).toEqual(['checkout', 'cart']);
  });

  it('returns no values when Tempo sends no tag values', async () => {
    get.mockResolvedValue({});

    expect(await tempoTagValues('resource.service.name', 0, 1)).toEqual([]);
  });
});

it('reads labelled log error counts from the selected Loki source', async () => {
  jest.mocked(requireDataSource).mockResolvedValueOnce('logs-uid');
  get.mockResolvedValue({
    data: { result: [{ metric: { service_name: 'checkout' }, value: [1700000000, '12'] }] },
  });

  const values = await lokiInstant('count_over_time({service_name="checkout"}[30m])', 1700000000);

  expect(get).toHaveBeenCalledWith(
    '/api/datasources/proxy/uid/logs-uid/loki/api/v1/query',
    { query: 'count_over_time({service_name="checkout"}[30m])', time: 1700000000 },
    undefined,
    { showErrorAlert: false }
  );
  expect(values).toEqual([{ metric: { service_name: 'checkout' }, value: 12 }]);
});

it('requests label-name volumes across the selected Loki source and time range', async () => {
  jest.mocked(requireDataSource).mockResolvedValueOnce('logs-uid');
  get.mockResolvedValue({
    data: {
      result: [
        { metric: { service_name: '' }, value: [1700000000, '2500000'] },
        { metric: { namespace: '' }, value: [1700000000, '1000000'] },
      ],
    },
  });

  const volumes = await lokiLabelVolumes(1700000000, 1700001800);

  expect(requireDataSource).toHaveBeenLastCalledWith('logs');
  expect(get).toHaveBeenCalledWith(
    '/api/datasources/proxy/uid/logs-uid/loki/api/v1/index/volume',
    {
      query: '{}',
      start: '2023-11-14T22:13:20.000Z',
      end: '2023-11-14T22:43:20.000Z',
      aggregateBy: 'labels',
      limit: 100,
    },
    undefined,
    { showErrorAlert: false }
  );
  expect(volumes).toEqual([
    { metric: { service_name: '' }, value: 2500000 },
    { metric: { namespace: '' }, value: 1000000 },
  ]);
});
