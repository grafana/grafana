import { getDefaultDataSourceInstanceListItem as stableGetDefaultDataSourceInstanceListItem } from '@grafana/runtime';

import { getMockedListItem } from '../utils/mocks';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockStableGetDefaultDataSourceInstanceListItem = jest.mocked(stableGetDefaultDataSourceInstanceListItem);

const items = [getMockedListItem({ uid: 'ds-a', name: 'A' }), getMockedListItem({ uid: 'ds-b', name: 'B' })];

describe('getDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDefaultDataSourceInstanceListItem.mockResolvedValue(items[0]);
  });

  it('should call the stable export', async () => {
    const result = await getDefaultDataSourceInstanceListItem(items);

    expect(mockStableGetDefaultDataSourceInstanceListItem).toHaveBeenCalledWith(items);
    expect(result?.uid).toBe('ds-a');
  });
});
