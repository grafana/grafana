import { PropsWithChildren } from 'react';
import { act, getWrapper, renderHook, screen, waitFor } from 'test/test-utils';

import * as runtime from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

// Create mock UserStorage instance that can be configured per test
const mockUserStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

// Mock UserStorage class from @grafana/runtime/internal
// This prevents the module-level instance from caching state across tests
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation(() => mockUserStorage),
}));

// Mock config BEFORE any imports that use it (jest.mock is hoisted)
// This ensures config.namespace and config.bootData.user are set when UserStorage module loads
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    namespace: 'default',
    bootData: {
      ...jest.requireActual('@grafana/runtime').config.bootData,
      navTree: [],
      user: {
        uid: 'test-user-123',
        id: 123,
        isSignedIn: true,
      },
    },
  },
}));

import { trackSavedSearchApplied, useSavedSearches } from './useSavedSearches';

// Set up MSW server for other handlers (not UserStorage - that's mocked directly)
setupMswServer();

// Mock data is ordered as it will appear after sorting by useSavedSearches:
// default search first, then alphabetically by name
const mockSavedSearches = [
  {
    id: '2',
    name: 'Default Search',
    query: 'label:team=A',
    isDefault: true,
    createdAt: Date.now() - 2000,
  },
  {
    id: '1',
    name: 'Test Search 1',
    query: 'state:firing',
    isDefault: false,
    createdAt: Date.now() - 1000,
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
    localStorage.clear();
    // Reset mock UserStorage to default behavior (empty storage)
    mockUserStorage.getItem.mockResolvedValue(null);
    mockUserStorage.setItem.mockResolvedValue(undefined);
  });

  describe('Initial loading', () => {
    it('should load saved searches from UserStorage', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toEqual(mockSavedSearches);
    });

    it('should handle empty storage gracefully', async () => {
      // Storage is empty by default after resetUserStorage() in afterEach

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toEqual([]);
    });

    it('should handle 404 (no stored data) gracefully', async () => {
      // When no data exists, UserStorage returns 404, which is handled as "not found"
      // The hook should return an empty array without error

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // UserStorage handles 404 gracefully - returns empty storage
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
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mixedData));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Invalid entries are filtered out, valid ones are preserved
      expect(result.current.savedSearches).toHaveLength(2);
      expect(result.current.savedSearches[0].name).toBe('Default Search');
      expect(result.current.savedSearches[1].name).toBe('Test Search 1');
    });

    it('should handle malformed JSON gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockUserStorage.getItem.mockResolvedValue('not valid json');

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
      // Start with empty storage (default mock behavior)

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

      // Verify data was persisted via UserStorage.setItem
      expect(mockUserStorage.setItem).toHaveBeenCalledWith(
        'savedSearches',
        expect.stringContaining('"name":"New Search"')
      );
    });

    it('should throw validation error for duplicate name (case-insensitive)', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.saveSearch('TEST SEARCH 1', 'state:pending')).rejects.toEqual({
          field: 'name',
          message: expect.stringContaining('already exists'),
        });
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
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.renameSearch('1', 'Renamed Search');
      });

      expect(result.current.savedSearches.find((s) => s.id === '1')?.name).toBe('Renamed Search');

      // Verify data was persisted via UserStorage.setItem
      expect(mockUserStorage.setItem).toHaveBeenCalledWith(
        'savedSearches',
        expect.stringContaining('"name":"Renamed Search"')
      );
    });

    it('should throw validation error for duplicate name on rename', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.renameSearch('1', 'Default Search')).rejects.toEqual({
          field: 'name',
          message: expect.stringContaining('already exists'),
        });
      });
    });
  });

  describe('deleteSearch', () => {
    it('should delete a search', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

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
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

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
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

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
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

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
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

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
