import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDefaultDataSourceInstanceListItem as rtGetDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockRuntimeGetDefaultDataSourceInstanceListItem = jest.mocked(rtGetDefaultDataSourceInstanceListItem);

function listItem(overrides: Partial<DataSourceInstanceListItem>): DataSourceInstanceListItem {
  return {
    uid: 'uid',
    type: 'loki',
    name: 'name',
    meta: {},
    isDefault: false,
    ...overrides,
  } as DataSourceInstanceListItem;
}

const flagged = listItem({ uid: 'ds-b', name: 'B', isDefault: true });
const notFlagged = listItem({ uid: 'ds-a', name: 'A' });
const items = [notFlagged, flagged];

describe('getDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuntimeGetDefaultDataSourceInstanceListItem.mockReturnValue(flagged);
  });

  it('should call correct function when getDefaultDataSourceInstanceListItem exists', () => {
    getDefaultDataSourceInstanceListItem(items);

    expect(mockRuntimeGetDefaultDataSourceInstanceListItem).toHaveBeenCalledWith(items);
  });

  it('should return the host answer rather than recomputing it locally', () => {
    // The local fallback would pick the flagged 'ds-b', so only the host can produce 'ds-a'.
    mockRuntimeGetDefaultDataSourceInstanceListItem.mockReturnValue(notFlagged);

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-a');
  });
});
