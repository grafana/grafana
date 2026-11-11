import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type SavedSearch } from '../components/saved-searches/savedSearchesSchema';

import { useGenericSavedSearches } from './useGenericSavedSearches';

const mockUserStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

// UserStorage keeps a module-level cache that tests outside the runtime package cannot clear, so a mocked
// instance is the only way to give every test an isolated, inspectable store.
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation(() => mockUserStorage),
}));

const STORAGE_KEY = 'testSavedSearches';

const defaultSearch: SavedSearch = {
  id: 'search-1',
  name: 'Keep me',
  query: 'old query',
  isDefault: true,
  createdAt: 1700000000000,
};

const otherSearch: SavedSearch = {
  id: 'search-2',
  name: 'Other',
  query: 'label:team=infra',
  isDefault: false,
  createdAt: 1700000001000,
};

describe('useGenericSavedSearches.updateSearch', () => {
  const Wrapper = getWrapper({ renderWithRouter: true });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStorage.setItem.mockResolvedValue(undefined);
  });

  async function setup(stored: SavedSearch[]) {
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useGenericSavedSearches({ storageKey: STORAGE_KEY }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    return result;
  }

  it('replaces only the matching search query and persists the list under the configured key', async () => {
    const result = await setup([defaultSearch, otherSearch]);

    await act(async () => {
      await result.current.updateSearch('search-1', 'namespace:folder-1');
    });

    const expected = [{ ...defaultSearch, query: 'namespace:folder-1' }, otherSearch];
    expect(result.current.savedSearches).toEqual(expected);
    expect(mockUserStorage.setItem).toHaveBeenCalledTimes(1);
    const [persistedKey, persistedJson] = mockUserStorage.setItem.mock.calls[0];
    expect(persistedKey).toBe(STORAGE_KEY);
    expect(JSON.parse(persistedJson)).toEqual(expected);
  });

  it('neither changes the saved searches nor writes to storage when the ID does not exist', async () => {
    const result = await setup([defaultSearch, otherSearch]);

    await act(async () => {
      await result.current.updateSearch('does-not-exist', 'namespace:folder-1');
    });

    expect(result.current.savedSearches).toEqual([defaultSearch, otherSearch]);
    expect(mockUserStorage.setItem).not.toHaveBeenCalled();
  });
});
