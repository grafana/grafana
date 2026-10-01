import { type DataSourceInstanceSettings } from '@grafana/data';
import { setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';

import { getMockedDatasourceSrv } from '../utils/mocks';

import { getDataSourceInstanceList } from './getDataSourceInstanceList';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceInstanceSettings;

describe('getDataSourceInstanceList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
    mockDatasourceSrv.getList = jest.fn().mockReturnValue([mockData]);
  });

  it('should call correct function when getDataSourceInstanceList does not exists', async () => {
    await getDataSourceInstanceList({ pluginId: 'loki' });

    expect(mockDatasourceSrv.getList).toHaveBeenCalled();
    expect(mockDatasourceSrv.getList).toHaveBeenCalledWith({ pluginId: 'loki' });
  });

  it('should return correct response when getDataSourceInstanceList does not exists', async () => {
    const result = await getDataSourceInstanceList({ pluginId: 'loki' });

    expect(result).toStrictEqual([
      {
        uid: 'ds-logs',
        type: 'loki',
        name: 'Loki',
        meta: {},
        isDefault: false,
        apiVersion: undefined,
      },
    ]);
  });

  it('should relay filter function result when getDataSourceInstanceList does not exists', async () => {
    const mockFilter = jest.fn();
    mockDatasourceSrv.getList = jest.fn().mockImplementation((filters) => {
      filters.filter(mockData);
      return [mockData];
    });

    await getDataSourceInstanceList({ filter: mockFilter });

    expect(mockFilter).toHaveBeenCalled();
    expect(mockFilter).toHaveBeenCalledWith({
      apiVersion: undefined,
      isDefault: false,
      meta: {},
      name: 'Loki',
      type: 'loki',
      uid: 'ds-logs',
    });
  });

  it('should reject when getDataSourceSrv is not setup', async () => {
    setDataSourceSrv(undefined as unknown as DataSourceSrv);

    await expect(getDataSourceInstanceList({ pluginId: 'loki' })).rejects.toThrow();
  });
});
