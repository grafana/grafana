import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList as rtGetDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getDataSourceInstanceList } from './getDataSourceInstanceList';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
  getDataSourceInstanceList: jest.fn(),
}));

const mockRuntimeGetDataSourceInstanceList = jest.mocked(rtGetDataSourceInstanceList);
const mockData = {
  uid: 'ds-logs',
  type: 'loki',
  name: 'Loki',
  meta: {},
  isDefault: true,
} as DataSourceInstanceListItem;

describe('getDataSourceInstanceList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuntimeGetDataSourceInstanceList.mockResolvedValue([mockData]);
  });

  it('should call correct function when getDataSourceInstanceList exists', async () => {
    await getDataSourceInstanceList({ pluginId: 'loki' });

    expect(mockRuntimeGetDataSourceInstanceList).toHaveBeenCalled();
    expect(mockRuntimeGetDataSourceInstanceList).toHaveBeenCalledWith({ pluginId: 'loki' });
  });

  it('should return correct response when getDataSourceInstanceList exists', async () => {
    const result = await getDataSourceInstanceList({ pluginId: 'loki' });

    expect(result).toStrictEqual([
      {
        uid: 'ds-logs',
        type: 'loki',
        name: 'Loki',
        meta: {},
        isDefault: true,
      },
    ]);
  });
});
