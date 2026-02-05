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

import {
  loadDefaultTriageSavedSearch,
  trackTriageSavedSearchApplied,
  useTriageSavedSearches,
} from './useTriageSavedSearches';

// Set up MSW server for other handlers (not UserStorage - that's mocked directly)
setupMswServer();

// Mock data is ordered as it will appear after sorting by useTriageSavedSearches:
// default search first, then alphabetically by name
const mockSavedSearches = [
  {
    id: '2',
    name: 'Default Triage Search',
    query: 'var-filters=alertname%7C%3D%7Ctest&var-groupBy=severity&from=now-1h&to=now',
    isDefault: true,
    createdAt: Date.now() - 2000,
  },
  {
    id: '1',
    name: 'Critical Alerts',
    query: 'var-filters=severity%7C%3D%7Ccritical',
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

describe('useTriageSavedSearches', () => {
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

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toEqual(mockSavedSearches);
    });

    it('should handle empty storage gracefully', async () => {
      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

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

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Invalid entries are filtered out, valid ones are preserved
      expect(result.current.savedSearches).toHaveLength(2);
      expect(result.current.savedSearches[0].name).toBe('Default Triage Search');
      expect(result.current.savedSearches[1].name).toBe('Critical Alerts');
    });

    it('should handle malformed JSON gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockUserStorage.getItem.mockResolvedValue('not valid json');

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Malformed JSON is handled gracefully - returns empty array without showing error notification
      // The error is logged but doesn't disrupt the UI
      expect(result.current.savedSearches).toEqual([]);
    });
  });

  describe('saveSearch', () => {
    it('should save a new search with triage storage key', async () => {
      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveSearch('New Triage Search', 'var-filters=test&var-groupBy=severity');
      });

      expect(result.current.savedSearches).toHaveLength(1);
      expect(result.current.savedSearches[0].name).toBe('New Triage Search');
      expect(result.current.savedSearches[0].query).toBe('var-filters=test&var-groupBy=severity');

      // Verify data was persisted via UserStorage.setItem with TRIAGE key
      expect(mockUserStorage.setItem).toHaveBeenCalledWith(
        'triageSavedSearches',
        expect.stringContaining('"name":"New Triage Search"')
      );
    });

    it('should throw validation error for duplicate name (case-insensitive)', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.saveSearch('CRITICAL ALERTS', 'var-filters=test')).rejects.toEqual({
          field: 'name',
          message: expect.stringContaining('already exists'),
        });
      });
    });

    it('should track analytics with page: triage on save', async () => {
      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveSearch('New Search', 'var-filters=test');
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_saved_search_save',
        expect.objectContaining({
          hasDefault: false,
          totalCount: 1,
          page: 'triage',
        })
      );
    });
  });

  describe('renameSearch', () => {
    it('should rename an existing search', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.renameSearch('1', 'Renamed Search');
      });

      expect(result.current.savedSearches.find((s) => s.id === '1')?.name).toBe('Renamed Search');

      // Verify data was persisted via UserStorage.setItem
      expect(mockUserStorage.setItem).toHaveBeenCalledWith(
        'triageSavedSearches',
        expect.stringContaining('"name":"Renamed Search"')
      );
    });

    it('should track analytics with page: triage on rename', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.renameSearch('1', 'Renamed Search');
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_rename', {
        page: 'triage',
      });
    });
  });

  describe('deleteSearch', () => {
    it('should delete a search', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

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

    it('should track analytics with page: triage on delete', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteSearch('1');
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_delete', {
        page: 'triage',
      });
    });
  });

  describe('setDefaultSearch', () => {
    it('should set a search as default', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

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

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setDefaultSearch(null);
      });

      expect(result.current.savedSearches.every((s) => !s.isDefault)).toBe(true);
    });

    it('should track analytics with page: triage on set default', async () => {
      mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useTriageSavedSearches(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setDefaultSearch('1');
      });

      expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_set_default', {
        action: 'set',
        page: 'triage',
      });
    });
  });
});

describe('loadDefaultTriageSavedSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStorage.getItem.mockResolvedValue(null);
  });

  it('should return default search when one exists', async () => {
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

    const result = await loadDefaultTriageSavedSearch();

    expect(result).toEqual(mockSavedSearches[0]);
    expect(result?.isDefault).toBe(true);
  });

  it('should return null when no default search exists', async () => {
    const noDefaultSearches = mockSavedSearches.map((s) => ({ ...s, isDefault: false }));
    mockUserStorage.getItem.mockResolvedValue(JSON.stringify(noDefaultSearches));

    const result = await loadDefaultTriageSavedSearch();

    expect(result).toBeNull();
  });

  it('should return null when storage is empty', async () => {
    mockUserStorage.getItem.mockResolvedValue(null);

    const result = await loadDefaultTriageSavedSearch();

    expect(result).toBeNull();
  });
});

describe('trackTriageSavedSearchApplied', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track with isDefault true and page: triage for default searches', () => {
    trackTriageSavedSearchApplied({
      id: '1',
      name: 'Default',
      query: 'var-filters=test',
      isDefault: true,
      createdAt: Date.now(),
    });

    expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_apply', {
      isDefault: true,
      page: 'triage',
    });
  });

  it('should track with isDefault false and page: triage for non-default searches', () => {
    trackTriageSavedSearchApplied({
      id: '1',
      name: 'Regular',
      query: 'var-filters=test',
      isDefault: false,
      createdAt: Date.now(),
    });

    expect(runtime.reportInteraction).toHaveBeenCalledWith('grafana_alerting_saved_search_apply', {
      isDefault: false,
      page: 'triage',
    });
  });
});
