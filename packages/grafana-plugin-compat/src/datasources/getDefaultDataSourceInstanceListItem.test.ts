import { getDefaultDataSourceInstanceListItem as rtGetDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

import { getMockedListItem } from '../utils/mocks';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockRuntimeGetDefaultDataSourceInstanceListItem = jest.mocked(rtGetDefaultDataSourceInstanceListItem);

const flagged = getMockedListItem({ uid: 'ds-b', name: 'B' });
const notFlagged = getMockedListItem({ uid: 'ds-a', name: 'A' });
const items = [notFlagged, flagged];

describe('getDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuntimeGetDefaultDataSourceInstanceListItem.mockResolvedValue(flagged);
  });

  it('should call correct function when getDefaultDataSourceInstanceListItem exists', async () => {
    await getDefaultDataSourceInstanceListItem(items);

    expect(mockRuntimeGetDefaultDataSourceInstanceListItem).toHaveBeenCalledWith(items);
  });

  it('should return the host answer rather than recomputing it locally', async () => {
    mockRuntimeGetDefaultDataSourceInstanceListItem.mockResolvedValue(notFlagged);

    expect((await getDefaultDataSourceInstanceListItem(items))?.uid).toBe('ds-a');
  });
});
