import { PropsWithChildren } from 'react';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import * as runtime from '@grafana/runtime';

import * as triageSavedSearchUtilsMod from '../scene/triageSavedSearchUtils';

import { useApplyDefaultTriageSearch } from './useApplyDefaultTriageSearch';
import * as useTriageSavedSearchesMod from './useTriageSavedSearches';

// Mock the dependencies
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      alertingTriageSavedSearches: true,
    },
  },
}));

jest.mock('./useTriageSavedSearches', () => ({
  loadDefaultTriageSavedSearch: jest.fn(),
  trackTriageSavedSearchAutoApply: jest.fn(),
}));

jest.mock('../scene/triageSavedSearchUtils', () => ({
  applySavedSearch: jest.fn(),
  serializeCurrentState: jest.fn(),
}));

const loadDefaultTriageSavedSearchMock = useTriageSavedSearchesMod.loadDefaultTriageSavedSearch as jest.MockedFunction<
  typeof useTriageSavedSearchesMod.loadDefaultTriageSavedSearch
>;
const trackTriageSavedSearchAutoApplyMock =
  useTriageSavedSearchesMod.trackTriageSavedSearchAutoApply as jest.MockedFunction<
    typeof useTriageSavedSearchesMod.trackTriageSavedSearchAutoApply
  >;
const applySavedSearchMock = triageSavedSearchUtilsMod.applySavedSearch as jest.MockedFunction<
  typeof triageSavedSearchUtilsMod.applySavedSearch
>;
const serializeCurrentStateMock = triageSavedSearchUtilsMod.serializeCurrentState as jest.MockedFunction<
  typeof triageSavedSearchUtilsMod.serializeCurrentState
>;

const SESSION_VISITED_KEY = 'grafana.alerting.triagePage.visited';

function createWrapper() {
  const Wrapper = getWrapper({ renderWithRouter: true });
  return function WrapperWithNotifications({ children }: PropsWithChildren) {
    return <Wrapper>{children}</Wrapper>;
  };
}

describe('useApplyDefaultTriageSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();

    // Default mock behavior
    loadDefaultTriageSavedSearchMock.mockResolvedValue(null);
    serializeCurrentStateMock.mockReturnValue('');

    // Re-enable feature toggle for each test
    runtime.config.featureToggles.alertingTriageSavedSearches = true;
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should apply default search on first visit when no active filters', async () => {
    const mockDefaultSearch = {
      id: '1',
      name: 'Default Search',
      query: 'var-filters=test&var-groupBy=severity',
      isDefault: true,
      createdAt: Date.now(),
    };

    loadDefaultTriageSavedSearchMock.mockResolvedValue(mockDefaultSearch);
    serializeCurrentStateMock.mockReturnValue(''); // No active filters

    const { result } = renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(loadDefaultTriageSavedSearchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.isApplying).toBe(false);
    });

    expect(applySavedSearchMock).toHaveBeenCalledWith(mockDefaultSearch.query);
    expect(trackTriageSavedSearchAutoApplyMock).toHaveBeenCalled();
  });

  it('should not apply default search when active filters exist', async () => {
    const mockDefaultSearch = {
      id: '1',
      name: 'Default Search',
      query: 'var-filters=test',
      isDefault: true,
      createdAt: Date.now(),
    };

    loadDefaultTriageSavedSearchMock.mockResolvedValue(mockDefaultSearch);
    serializeCurrentStateMock.mockReturnValue('var-filters=existing'); // Active filters

    renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    // Wait a bit to ensure async operations have had time to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loadDefaultTriageSavedSearchMock).not.toHaveBeenCalled();
    expect(applySavedSearchMock).not.toHaveBeenCalled();
  });

  it('should not apply default search when groupBy is active', async () => {
    const mockDefaultSearch = {
      id: '1',
      name: 'Default Search',
      query: 'var-groupBy=severity',
      isDefault: true,
      createdAt: Date.now(),
    };

    loadDefaultTriageSavedSearchMock.mockResolvedValue(mockDefaultSearch);
    serializeCurrentStateMock.mockReturnValue('var-groupBy=severity'); // Active groupBy

    renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loadDefaultTriageSavedSearchMock).not.toHaveBeenCalled();
    expect(applySavedSearchMock).not.toHaveBeenCalled();
  });

  it('should not apply default search on subsequent visits in same session', async () => {
    const mockDefaultSearch = {
      id: '1',
      name: 'Default Search',
      query: 'var-filters=test',
      isDefault: true,
      createdAt: Date.now(),
    };

    loadDefaultTriageSavedSearchMock.mockResolvedValue(mockDefaultSearch);
    serializeCurrentStateMock.mockReturnValue('');

    // Mark as already visited
    sessionStorage.setItem(SESSION_VISITED_KEY, 'true');

    renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loadDefaultTriageSavedSearchMock).not.toHaveBeenCalled();
    expect(applySavedSearchMock).not.toHaveBeenCalled();
  });

  it('should not apply when no default search exists', async () => {
    loadDefaultTriageSavedSearchMock.mockResolvedValue(null);
    serializeCurrentStateMock.mockReturnValue('');

    const { result } = renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(loadDefaultTriageSavedSearchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.isApplying).toBe(false);
    });

    expect(applySavedSearchMock).not.toHaveBeenCalled();
    expect(trackTriageSavedSearchAutoApplyMock).not.toHaveBeenCalled();
  });

  it('should not apply when feature toggle is disabled', async () => {
    runtime.config.featureToggles.alertingTriageSavedSearches = false;

    const mockDefaultSearch = {
      id: '1',
      name: 'Default Search',
      query: 'var-filters=test',
      isDefault: true,
      createdAt: Date.now(),
    };

    loadDefaultTriageSavedSearchMock.mockResolvedValue(mockDefaultSearch);
    serializeCurrentStateMock.mockReturnValue('');

    renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loadDefaultTriageSavedSearchMock).not.toHaveBeenCalled();
    expect(applySavedSearchMock).not.toHaveBeenCalled();
  });

  it('should clear session storage on unmount', async () => {
    serializeCurrentStateMock.mockReturnValue('');
    loadDefaultTriageSavedSearchMock.mockResolvedValue(null);

    const { unmount } = renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    // Wait for initial effect
    await waitFor(() => {
      expect(sessionStorage.getItem(SESSION_VISITED_KEY)).toBe('true');
    });

    unmount();

    // Session storage should be cleared on unmount
    expect(sessionStorage.getItem(SESSION_VISITED_KEY)).toBeNull();
  });

  it('should return isApplying true while loading', async () => {
    // Create a delayed promise to keep loading state
    let resolvePromise: (value: null) => void;
    const loadPromise = new Promise<null>((resolve) => {
      resolvePromise = resolve;
    });
    loadDefaultTriageSavedSearchMock.mockReturnValue(loadPromise);
    serializeCurrentStateMock.mockReturnValue('');

    const { result } = renderHook(() => useApplyDefaultTriageSearch(), { wrapper: createWrapper() });

    // Should be applying while loading
    await waitFor(() => {
      expect(result.current.isApplying).toBe(true);
    });

    // Resolve the promise
    resolvePromise!(null);

    await waitFor(() => {
      expect(result.current.isApplying).toBe(false);
    });
  });
});
