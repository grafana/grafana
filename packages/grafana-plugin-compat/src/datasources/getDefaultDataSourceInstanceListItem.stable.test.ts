import { getDefaultDataSourceInstanceListItem as stableGetDefaultDataSourceInstanceListItem } from '@grafana/runtime';
import { getDefaultDataSourceInstanceListItem as unstableGetDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

import { getMockedListItem } from '../utils/mocks';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockStableGetDefaultDataSourceInstanceListItem = jest.mocked(stableGetDefaultDataSourceInstanceListItem);
const mockUnstableGetDefaultDataSourceInstanceListItem = jest.mocked(unstableGetDefaultDataSourceInstanceListItem);

const items = [getMockedListItem({ uid: 'ds-a', name: 'A' }), getMockedListItem({ uid: 'ds-b', name: 'B' })];

describe('getDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDefaultDataSourceInstanceListItem.mockResolvedValue(items[0]);
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await getDefaultDataSourceInstanceListItem(items);

    expect(mockStableGetDefaultDataSourceInstanceListItem).toHaveBeenCalledWith(items);
    expect(mockUnstableGetDefaultDataSourceInstanceListItem).not.toHaveBeenCalled();
    expect(result?.uid).toBe('ds-a');
  });
});
