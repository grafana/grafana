import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList as stableGetDataSourceInstanceList } from '@grafana/runtime';

import { getDataSourceInstanceList } from './getDataSourceInstanceList';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockStableGetDataSourceInstanceList = jest.mocked(stableGetDataSourceInstanceList);
const mockData = {
  uid: 'ds-logs',
  type: 'loki',
  name: 'Loki',
  meta: {},
} as DataSourceInstanceListItem;

describe('getDataSourceInstanceList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDataSourceInstanceList.mockResolvedValue([mockData]);
  });

  it('should call the stable export', async () => {
    const result = await getDataSourceInstanceList({ pluginId: 'loki' });

    expect(mockStableGetDataSourceInstanceList).toHaveBeenCalledWith({ pluginId: 'loki' });
    expect(result).toStrictEqual([mockData]);
  });
});
