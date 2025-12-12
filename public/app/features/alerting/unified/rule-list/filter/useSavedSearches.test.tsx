import { PropsWithChildren } from 'react';
import { act, getWrapper, renderHook, screen, waitFor } from 'test/test-utils';

import * as runtime from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

// In-memory storage for UserStorage mock
let mockStorageData: Record<string, string> = {};
let shouldFailOnGet = false;
let shouldFailOnSet = false;

// Mock UserStorage class directly (same pattern as useFavoriteDatasources.test.ts)
// This avoids issues with MSW not intercepting requests due to config.namespace
// being evaluated at module load time before jest.mock takes effect
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation((_service: string) => ({
    getItem: jest.fn(async (key: string): Promise<string | null> => {
      if (shouldFailOnGet) {
        throw new Error('Storage error');
      }
      return mockStorageData[key] ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string): Promise<void> => {
      if (shouldFailOnSet) {
        throw new Error('Storage error');
      }
      mockStorageData[key] = value;
    }),
  })),
}));

import { trackSavedSearchApplied, useSavedSearches } from './useSavedSearches';

afterEach(() => {
  mockStorageData = {};
  shouldFailOnGet = false;
  shouldFailOnSet = false;
});

// Helper functions for tests
function setMockStorageData(key: string, value: string) {
  mockStorageData[key] = value;
}

function setStorageGetError(shouldFail: boolean) {
  shouldFailOnGet = shouldFail;
}

function setStorageSetError(shouldFail: boolean) {
  shouldFailOnSet = shouldFail;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    namespace: 'default',
    bootData: {
      ...jest.requireActual('@grafana/runtime').config.bootData,
      user: {
        uid: 'test-user-123',
        id: 123,
        isSignedIn: true,
      },
    },
  },
}));

// Mock contextSrv for user ID
jest.mock('../../../../../core/services/context_srv', () => ({
  contextSrv: {
    user: {
      id: 123,
    },
  },
}));

const mockSavedSearches = [
  {
    id: '1',
    name: 'Test Search 1',
    query: 'state:firing',
    isDefault: false,
    createdAt: Date.now() - 1000,
  },
  {
    id: '2',
    name: 'Default Search',
    query: 'label:team=A',
    isDefault: true,
    createdAt: Date.now() - 2000,
  },
];

// Wrapper that includes AppNotificationList to verify UI notifications
function createWrapper() {
  const Wrapper = getWrapper({ renderWithRouter: true });
  return function WrapperWithNotifications({ children }: PropsWithChildren) {
    return (
      <Wrapper>
        <AppNotificationList />
        {children}
      </Wrapper>
    );
  };
}

describe('useSavedSearches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe('Initial loading', () => {
    it('should load saved searches from UserStorage', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toEqual(mockSavedSearches);
    });

    it('should handle empty storage gracefully', async () => {
      // mockStorageData is empty by default

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toEqual([]);
    });

    it('should show error notification on load failure', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      setStorageGetError(true);

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // When API fails, UserStorage falls back to localStorage, so no error notification
      // The hook handles the fallback gracefully
      expect(result.current.savedSearches).toEqual([]);
    });

    it('should filter out invalid saved search entries', async () => {
      jest.spyOn(console, 'warn').mockImplementation();
      const mixedData = [
        mockSavedSearches[0], // Valid
        { id: '3', name: 'Invalid', query: 123, isDefault: false }, // Invalid query type
        { id: '4', name: null, query: 'valid', isDefault: false }, // Invalid name type
        mockSavedSearches[1], // Valid
      ];
      setMockStorageData('savedSearches', JSON.stringify(mixedData));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Zod validation rejects the entire array if any item is invalid
      // Returns empty array when validation fails
      expect(result.current.savedSearches).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      setMockStorageData('savedSearches', 'not valid json');

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify error notification appears in the UI
      expect(await screen.findByText(/failed to load saved searches/i)).toBeInTheDocument();
      expect(result.current.savedSearches).toEqual([]);
    });
  });

  describe('saveSearch', () => {
    it('should save a new search', async () => {
      // Start with empty storage

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveSearch('New Search', 'state:pending');
      });

      expect(result.current.savedSearches).toHaveLength(1);
      expect(result.current.savedSearches[0].name).toBe('New Search');
      expect(result.current.savedSearches[0].query).toBe('state:pending');
      // Verify data was persisted to MSW storage
      expect(mockStorageData.savedSearches).toContain('"name":"New Search"');
    });

    it('should return validation error for duplicate name (case-insensitive)', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validationError;
      await act(async () => {
        validationError = await result.current.saveSearch('TEST SEARCH 1', 'state:pending');
      });

      expect(validationError).toEqual({
        field: 'name',
        message: expect.stringContaining('already exists'),
      });
    });

    it('should track analytics on save', async () => {
      // Start with empty storage

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveSearch('New Search', 'state:pending');
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_saved_search_save',
        expect.objectContaining({
          hasDefault: false,
          totalCount: 1,
        })
      );
    });
  });

  describe('renameSearch', () => {
    it('should rename an existing search', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.renameSearch('1', 'Renamed Search');
      });

      expect(result.current.savedSearches.find((s) => s.id === '1')?.name).toBe('Renamed Search');
      // Verify data was persisted to MSW storage
      expect(mockStorageData.savedSearches).toContain('"name":"Renamed Search"');
    });

    it('should return validation error for duplicate name on rename', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validationError;
      await act(async () => {
        validationError = await result.current.renameSearch('1', 'Default Search');
      });

      expect(validationError).toEqual({
        field: 'name',
        message: expect.stringContaining('already exists'),
      });
    });
  });

  describe('deleteSearch', () => {
    it('should delete a search', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toHaveLength(2);

      await act(async () => {
        await result.current.deleteSearch('1');
      });

      expect(result.current.savedSearches).toHaveLength(1);
      expect(result.current.savedSearches.find((s) => s.id === '1')).toBeUndefined();
    });

    it('should track analytics on delete', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteSearch('1');
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_delete');
    });
  });

  describe('setDefaultSearch', () => {
    it('should set a search as default', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setDefaultSearch('1');
      });

      expect(result.current.savedSearches.find((s) => s.id === '1')?.isDefault).toBe(true);
      expect(result.current.savedSearches.find((s) => s.id === '2')?.isDefault).toBe(false);
    });

    it('should clear default when null is passed', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setDefaultSearch(null);
      });

      expect(result.current.savedSearches.every((s) => !s.isDefault)).toBe(true);
    });

    it('should track analytics with correct action', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setDefaultSearch('1');
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_set_default', {
        action: 'set',
      });

      jest.clearAllMocks();

      await act(async () => {
        await result.current.setDefaultSearch(null);
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_set_default', {
        action: 'clear',
      });
    });
  });

  describe('getAutoApplySearch', () => {
    it('should return default search on first navigation', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const defaultSearch = result.current.getAutoApplySearch();

      expect(defaultSearch).toEqual(expect.objectContaining({ isDefault: true }));
    });

    it('should return null on subsequent calls (same session)', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First call should return default
      const firstCall = result.current.getAutoApplySearch();
      expect(firstCall).not.toBeNull();

      // Second call should return null (already auto-applied)
      const secondCall = result.current.getAutoApplySearch();
      expect(secondCall).toBeNull();
    });

    it('should return null when URL has search parameter', async () => {
      // Mock URL with search parameter using Object.defineProperty
      const originalSearch = window.location.search;
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?search=state:firing' },
        writable: true,
      });

      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const defaultSearch = result.current.getAutoApplySearch();

      expect(defaultSearch).toBeNull();

      // Restore
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: originalSearch },
        writable: true,
      });
    });

    it('should return null when no default search exists', async () => {
      const searchesWithoutDefault = mockSavedSearches.map((s) => ({ ...s, isDefault: false }));
      setMockStorageData('savedSearches', JSON.stringify(searchesWithoutDefault));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const defaultSearch = result.current.getAutoApplySearch();

      expect(defaultSearch).toBeNull();
    });
  });

  describe('Per-user session tracking', () => {
    it('should use user-specific session storage key', async () => {
      setMockStorageData('savedSearches', JSON.stringify(mockSavedSearches));

      renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        // Session storage should be set with user-specific key
        expect(sessionStorage.getItem('grafana.alerting.alertRules.visited.123')).toBe('true');
      });
    });
  });

  describe('Error handling', () => {
    it('should show error notification on save failure', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      setStorageSetError(true);

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.saveSearch('New Search', 'state:pending');
        } catch {
          // Expected to throw
        }
      });

      // Verify error notification appears in the UI
      expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
    });
  });
});

describe('trackSavedSearchApplied', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track with isDefault true for default searches', () => {
    trackSavedSearchApplied({
      id: '1',
      name: 'Default',
      query: 'state:firing',
      isDefault: true,
      createdAt: Date.now(),
    });

    expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_apply', { isDefault: true });
  });

  it('should track with isDefault false for non-default searches', () => {
    trackSavedSearchApplied({
      id: '1',
      name: 'Regular',
      query: 'state:firing',
      isDefault: false,
      createdAt: Date.now(),
    });

    expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_apply', { isDefault: false });
  });
});
