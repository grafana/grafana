import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

// Prevents the module-level UserStorage instance from caching state across tests.
const mockUserStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation(() => mockUserStorage),
}));

import { type SavedSearch } from '../components/saved-searches/savedSearchesSchema';

import { useGenericSavedSearches } from './useGenericSavedSearches';

const STORAGE_KEY = 'testSavedSearches';

function existingSearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    name: 'My search',
    query: 'label:team=infra',
    isDefault: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

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

  it("replaces only the matching entry's query, persisting it under the configured key and leaving the others unchanged", async () => {
    const other = existingSearch({ id: 'search-2', name: 'Other', query: 'unchanged' });
    const result = await setup([
      existingSearch({ id: 'search-1', name: 'Keep me', isDefault: true, query: 'old query' }),
      other,
    ]);

    await act(async () => {
      await result.current.updateSearch('search-1', 'namespace:folder-1');
    });

    const expected = [
      expect.objectContaining({ id: 'search-1', name: 'Keep me', isDefault: true, query: 'namespace:folder-1' }),
      other,
    ];
    expect(result.current.savedSearches).toEqual(expected);
    const [persistedKey, persistedJson] = mockUserStorage.setItem.mock.calls.at(-1);
    expect(persistedKey).toBe(STORAGE_KEY);
    expect(JSON.parse(persistedJson)).toEqual(expected);
  });

  it('is a no-op when the ID does not match any saved search', async () => {
    const stored = [existingSearch({ query: 'old query' })];
    const result = await setup(stored);

    await act(async () => {
      await result.current.updateSearch('does-not-exist', 'namespace:folder-1');
    });

    expect(result.current.savedSearches).toEqual(stored);
  });
});
