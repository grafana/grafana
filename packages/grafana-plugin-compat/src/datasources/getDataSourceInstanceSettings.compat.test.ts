import { type DataSourceInstanceSettings } from '@grafana/data';
import { setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';

import { getDataSourceInstanceSettings } from './getDataSourceInstanceSettings';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: undefined,
}));

const mockDatasourceSrv: DataSourceSrv = {
  get: jest.fn(),
  getInstanceSettings: jest.fn(),
  getList: jest.fn(),
  registerRuntimeDataSource: jest.fn(),
  reload: jest.fn(),
};
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceInstanceSettings;

describe('getDataSourceInstanceSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
    mockDatasourceSrv.getInstanceSettings = jest.fn().mockReturnValue(mockData);
  });

  it('should call correct function when getDataSourceInstanceSettings does not exists', async () => {
    await getDataSourceInstanceSettings('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockDatasourceSrv.getInstanceSettings).toHaveBeenCalled();
    expect(mockDatasourceSrv.getInstanceSettings).toHaveBeenCalledWith('ds-logs', {
      var: { text: 'some-var', value: 0 },
    });
  });

  it('should return correct response when getDataSourceInstanceSettings does not exists', async () => {
    const result = await getDataSourceInstanceSettings('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(result).toStrictEqual(mockData);
  });
});
