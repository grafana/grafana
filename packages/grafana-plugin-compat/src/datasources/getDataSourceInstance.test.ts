import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance as rtGetDataSourceInstance } from '@grafana/runtime/unstable';

import { getDataSourceInstance } from './getDataSourceInstance';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const mockRuntimeGetDataSourceInstance = jest.mocked(rtGetDataSourceInstance);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceApi;

describe('getDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuntimeGetDataSourceInstance.mockResolvedValue(mockData);
  });

  it('should call correct function when getDataSourceInstance exists', async () => {
    await getDataSourceInstance('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockRuntimeGetDataSourceInstance).toHaveBeenCalled();
    expect(mockRuntimeGetDataSourceInstance).toHaveBeenCalledWith('ds-logs', { var: { text: 'some-var', value: 0 } });
  });

  it('should return correct response when getDataSourceInstance exists', async () => {
    const result = await getDataSourceInstance('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(result).toStrictEqual(mockData);
  });
});
