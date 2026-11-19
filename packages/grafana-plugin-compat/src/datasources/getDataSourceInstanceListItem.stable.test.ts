import { getDataSourceInstanceListItem as stableGetDataSourceInstanceListItem } from '@grafana/runtime';

import { getMockedListItem } from '../utils/mocks';

import { getDataSourceInstanceListItem } from './getDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceListItem: jest.fn(),
}));

const mockStableGetDataSourceInstanceListItem = jest.mocked(stableGetDataSourceInstanceListItem);
const mockItem = getMockedListItem({ uid: 'ds-logs', type: 'loki', name: 'Loki' });

describe('getDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDataSourceInstanceListItem.mockResolvedValue(mockItem);
  });

  it('should call the stable export', async () => {
    const result = await getDataSourceInstanceListItem('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockStableGetDataSourceInstanceListItem).toHaveBeenCalledWith('ds-logs', {
      var: { text: 'some-var', value: 0 },
    });
    expect(result).toStrictEqual(mockItem);
  });
});
