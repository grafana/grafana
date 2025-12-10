import { act, renderHook, waitFor } from '@testing-library/react';

import * as runtime from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';

import { trackSavedSearchApplied, useSavedSearches } from './useSavedSearches';

// Mock UserStorage with default Promise-returning functions
// The factory runs when the module is imported, which creates the userStorage instance
jest.mock('@grafana/runtime/internal', () => ({
  UserStorage: jest.fn().mockImplementation(() => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Capture reference to the mock instance at module load time
// (before beforeEach can call clearAllMocks and wipe mock.results)
const mockUserStorageInstance = (UserStorage as jest.Mock).mock.results[0]?.value;

// Helper to get the UserStorage mock instance
function getMockUserStorageInstance() {
  return mockUserStorageInstance;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// Mock useAppNotification
const mockNotifyError = jest.fn();
jest.mock('../../../../../core/copy/appNotification', () => ({
  useAppNotification: () => ({
    error: mockNotifyError,
    success: jest.fn(),
    warning: jest.fn(),
  }),
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

describe('useSavedSearches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations with default values
    const instance = getMockUserStorageInstance();
    instance.getItem.mockResolvedValue(null);
    instance.setItem.mockResolvedValue(undefined);
    sessionStorage.clear();
  });

  describe('Initial loading', () => {
    it('should load saved searches from UserStorage', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toEqual(mockSavedSearches);
    });

    it('should handle empty storage gracefully', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(null);

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.savedSearches).toEqual([]);
    });

    it('should show error notification on load failure', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockNotifyError).toHaveBeenCalled();
    });

    it('should filter out invalid saved search entries', async () => {
      const mixedData = [
        mockSavedSearches[0], // Valid
        { id: '3', name: 'Invalid', query: 123, isDefault: false }, // Invalid query type
        { id: '4', name: null, query: 'valid', isDefault: false }, // Invalid name type
        mockSavedSearches[1], // Valid
      ];
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mixedData));

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only have the 2 valid entries
      expect(result.current.savedSearches).toHaveLength(2);
      expect(result.current.savedSearches[0].id).toBe('1');
      expect(result.current.savedSearches[1].id).toBe('2');
    });

    it('should handle malformed JSON gracefully', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue('not valid json');

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockNotifyError).toHaveBeenCalled();
      expect(result.current.savedSearches).toEqual([]);
    });
  });

  describe('saveSearch', () => {
    it('should save a new search', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(null);
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveSearch('New Search', 'state:pending');
      });

      expect(instance.setItem).toHaveBeenCalledWith('savedSearches', expect.stringContaining('"name":"New Search"'));
      expect(result.current.savedSearches).toHaveLength(1);
      expect(result.current.savedSearches[0].name).toBe('New Search');
      expect(result.current.savedSearches[0].query).toBe('state:pending');
    });

    it('should return validation error for duplicate name (case-insensitive)', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(null);
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.renameSearch('1', 'Renamed Search');
      });

      expect(instance.setItem).toHaveBeenCalledWith(
        'savedSearches',
        expect.stringContaining('"name":"Renamed Search"')
      );
      expect(result.current.savedSearches.find((s) => s.id === '1')?.name).toBe('Renamed Search');
    });

    it('should return validation error for duplicate name on rename', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setDefaultSearch(null);
      });

      expect(result.current.savedSearches.every((s) => !s.isDefault)).toBe(true);
    });

    it('should track analytics with correct action', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));
      instance.setItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const defaultSearch = result.current.getAutoApplySearch();

      expect(defaultSearch).toEqual(expect.objectContaining({ isDefault: true }));
    });

    it('should return null on subsequent calls (same session)', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches());

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

      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      const { result } = renderHook(() => useSavedSearches());

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
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(searchesWithoutDefault));

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const defaultSearch = result.current.getAutoApplySearch();

      expect(defaultSearch).toBeNull();
    });
  });

  describe('Per-user session tracking', () => {
    it('should use user-specific session storage key', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(JSON.stringify(mockSavedSearches));

      renderHook(() => useSavedSearches());

      await waitFor(() => {
        // Session storage should be set with user-specific key
        expect(sessionStorage.getItem('grafana.alerting.alertRules.visited.123')).toBe('true');
      });
    });
  });

  describe('Error handling', () => {
    it('should show error notification on save failure', async () => {
      const instance = getMockUserStorageInstance();
      instance.getItem.mockResolvedValue(null);
      instance.setItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSavedSearches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveSearch('New Search', 'state:pending');
      });

      expect(mockNotifyError).toHaveBeenCalled();
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
