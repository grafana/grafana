import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance as stableGetDataSourceInstance } from '@grafana/runtime';

import { getDataSourceInstance } from './getDataSourceInstance';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstance: jest.fn(),
}));

const mockStableGetDataSourceInstance = jest.mocked(stableGetDataSourceInstance);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceApi;

describe('getDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDataSourceInstance.mockResolvedValue(mockData);
  });

  it('should call the stable export', async () => {
    const result = await getDataSourceInstance('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockStableGetDataSourceInstance).toHaveBeenCalledWith('ds-logs', { var: { text: 'some-var', value: 0 } });
    expect(result).toStrictEqual(mockData);
  });
});
