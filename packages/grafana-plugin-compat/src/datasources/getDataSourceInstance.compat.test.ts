import { type DataSourceApi } from '@grafana/data';
import { setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';

import { getMockedDatasourceSrv } from '../utils/mocks';

import { getDataSourceInstance } from './getDataSourceInstance';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceApi;

describe('getDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
    mockDatasourceSrv.get = jest.fn().mockResolvedValue(mockData);
  });

  it('should call correct function when getDataSourceInstance does not exists', async () => {
    await getDataSourceInstance('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockDatasourceSrv.get).toHaveBeenCalled();
    expect(mockDatasourceSrv.get).toHaveBeenCalledWith('ds-logs', { var: { text: 'some-var', value: 0 } });
  });

  it('should return correct response when getDataSourceInstance does not exists', async () => {
    const result = await getDataSourceInstance('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(result).toStrictEqual(mockData);
  });

  it('should reject when getDataSourceSrv is not setup', async () => {
    setDataSourceSrv(undefined as unknown as DataSourceSrv);

    await expect(getDataSourceInstance('ds-logs')).rejects.toThrow();
  });
});
