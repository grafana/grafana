import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance as stableGetDataSourceInstance } from '@grafana/runtime';
import { getDataSourceInstance as unstableGetDataSourceInstance } from '@grafana/runtime/unstable';

import { getDataSourceInstance } from './getDataSourceInstance';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstance: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const mockStableGetDataSourceInstance = jest.mocked(stableGetDataSourceInstance);
const mockUnstableGetDataSourceInstance = jest.mocked(unstableGetDataSourceInstance);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceApi;

describe('getDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDataSourceInstance.mockResolvedValue(mockData);
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await getDataSourceInstance('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockStableGetDataSourceInstance).toHaveBeenCalledWith('ds-logs', { var: { text: 'some-var', value: 0 } });
    expect(mockUnstableGetDataSourceInstance).not.toHaveBeenCalled();
    expect(result).toStrictEqual(mockData);
  });
});
