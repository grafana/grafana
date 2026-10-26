import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList as stableGetDataSourceInstanceList } from '@grafana/runtime';
import { getDataSourceInstanceList as unstableGetDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getDataSourceInstanceList } from './getDataSourceInstanceList';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceList: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockStableGetDataSourceInstanceList = jest.mocked(stableGetDataSourceInstanceList);
const mockUnstableGetDataSourceInstanceList = jest.mocked(unstableGetDataSourceInstanceList);
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

  it('should prefer the stable export over the unstable one', async () => {
    const result = await getDataSourceInstanceList({ pluginId: 'loki' });

    expect(mockStableGetDataSourceInstanceList).toHaveBeenCalledWith({ pluginId: 'loki' });
    expect(mockUnstableGetDataSourceInstanceList).not.toHaveBeenCalled();
    expect(result).toStrictEqual([mockData]);
  });
});
