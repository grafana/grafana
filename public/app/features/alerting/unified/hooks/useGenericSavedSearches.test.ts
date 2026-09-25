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

  it('replaces only the matching entry\'s query, leaving name and default status untouched', async () => {
    const stored = [existingSearch({ id: 'search-1', name: 'Keep me', isDefault: true, query: 'old query' })];
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGenericSavedSearches({ storageKey: STORAGE_KEY }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSearch('search-1', 'namespace:folder-1');
    });

    expect(result.current.savedSearches).toEqual([
      expect.objectContaining({ id: 'search-1', name: 'Keep me', isDefault: true, query: 'namespace:folder-1' }),
    ]);
  });

  it('persists the updated query to UserStorage under the configured key', async () => {
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify([existingSearch({ query: 'old query' })]));

    const { result } = renderHook(() => useGenericSavedSearches({ storageKey: STORAGE_KEY }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSearch('search-1', 'namespace:folder-1');
    });

    const [persistedKey, persistedJson] = mockUserStorage.setItem.mock.calls.at(-1);
    expect(persistedKey).toBe(STORAGE_KEY);
    expect(JSON.parse(persistedJson)).toEqual([
      expect.objectContaining({ id: 'search-1', query: 'namespace:folder-1' }),
    ]);
  });

  it('leaves the other entries in a multi-entry collection unchanged', async () => {
    const other = existingSearch({ id: 'search-2', name: 'Other', query: 'unchanged' });
    mockUserStorage.getItem.mockResolvedValue(
      JSON.stringify([existingSearch({ id: 'search-1', query: 'old query' }), other])
    );

    const { result } = renderHook(() => useGenericSavedSearches({ storageKey: STORAGE_KEY }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSearch('search-1', 'namespace:folder-1');
    });

    expect(result.current.savedSearches.find((s) => s.id === 'search-2')).toEqual(other);
  });

  it('is a no-op when the ID does not match any saved search', async () => {
    const stored = [existingSearch({ query: 'old query' })];
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useGenericSavedSearches({ storageKey: STORAGE_KEY }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSearch('does-not-exist', 'namespace:folder-1');
    });

    expect(result.current.savedSearches).toEqual(stored);
  });
});
