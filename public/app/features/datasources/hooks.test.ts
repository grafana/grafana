import { renderHook, act, waitFor } from '@testing-library/react';

import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceList, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { TestDataSettings } from '../query/state/mocks/mockDataSource';

import { useDatasources, useRecentlyUsedDataSources } from './hooks';

// Mock react-use's useLocalStorage, keeping the real useAsync
jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useLocalStorage: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  getDataSourceInstanceList: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockUseLocalStorage = jest.requireMock('react-use').useLocalStorage;
const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);
const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);

describe('useRecentlyUsedDataSources', () => {
  let mockSetStorage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetStorage = jest.fn();

    // Default mock implementation
    mockUseLocalStorage.mockReturnValue([[], mockSetStorage]);
  });

  describe('basic functionality', () => {
    it('should return an array and a function', () => {
      const { result } = renderHook(() => useRecentlyUsedDataSources());

      expect(Array.isArray(result.current[0])).toBe(true);
      expect(typeof result.current[1]).toBe('function');
    });

    it('should return stored values from local storage', () => {
      const storedValues = ['uid1', 'uid2', 'uid3'];
      mockUseLocalStorage.mockReturnValue([storedValues, mockSetStorage]);

      const { result } = renderHook(() => useRecentlyUsedDataSources());

      expect(result.current[0]).toEqual(storedValues);
    });
  });

  describe('adding data sources', () => {
    it('should add a new data source to an empty list', () => {
      const { result } = renderHook(() => useRecentlyUsedDataSources());
      const dataSource = { ...TestDataSettings, uid: 'test-uid' };

      act(() => {
        result.current[1](dataSource);
      });

      expect(mockSetStorage).toHaveBeenCalledWith(['test-uid']);
    });

    it('should add a new data source to the end of existing list', () => {
      const existingValues = ['uid1', 'uid2'];
      mockUseLocalStorage.mockReturnValue([existingValues, mockSetStorage]);

      const { result } = renderHook(() => useRecentlyUsedDataSources());
      const dataSource = { ...TestDataSettings, uid: 'test-uid' };

      act(() => {
        result.current[1](dataSource);
      });

      expect(mockSetStorage).toHaveBeenCalledWith(['uid1', 'uid2', 'test-uid']);
    });

    it('should not store built-in data sources', () => {
      const { result } = renderHook(() => useRecentlyUsedDataSources());
      const builtInDataSource = { ...TestDataSettings, meta: { ...TestDataSettings.meta, builtIn: true } };

      act(() => {
        result.current[1](builtInDataSource);
      });

      expect(mockSetStorage).not.toHaveBeenCalled();
    });
  });

  describe('duplicate handling', () => {
    it('should move existing data source to the end when adding duplicate', () => {
      const existingValues = ['uid1', 'test-uid', 'uid3'];
      mockUseLocalStorage.mockReturnValue([existingValues, mockSetStorage]);

      const { result } = renderHook(() => useRecentlyUsedDataSources());
      const dataSource = { ...TestDataSettings, uid: 'test-uid' };

      act(() => {
        result.current[1](dataSource);
      });

      // uid2 should be moved to the end, others should maintain order
      expect(mockSetStorage).toHaveBeenCalledWith(['uid1', 'uid3', 'test-uid']);
    });
  });

  describe('maximum items limit', () => {
    it('should limit the array to 5 items when adding to a full list', () => {
      const existingValues = ['uid1', 'uid2', 'uid3', 'uid4', 'uid5'];
      mockUseLocalStorage.mockReturnValue([existingValues, mockSetStorage]);

      const { result } = renderHook(() => useRecentlyUsedDataSources());
      const dataSource = { ...TestDataSettings, uid: 'test-uid' };

      act(() => {
        result.current[1](dataSource);
      });

      // Should remove the first item and add new one at the end
      expect(mockSetStorage).toHaveBeenCalledWith(['uid2', 'uid3', 'uid4', 'uid5', 'test-uid']);
    });
  });
});

describe('useDatasources', () => {
  function createSettings(uid: string, name: string): DataSourceInstanceSettings {
    return { ...TestDataSettings, uid, name };
  }

  function toListItem(settings: DataSourceInstanceSettings): DataSourceInstanceListItem {
    const { uid, type, name, meta, readOnly } = settings;
    return { uid, type, name, meta, readOnly, isDefault: settings.isDefault ?? false };
  }

  const settingsA = createSettings('uid-a', 'Datasource A');
  const settingsB = createSettings('uid-b', 'Datasource B');
  const settingsByUid: Record<string, DataSourceInstanceSettings> = {
    [settingsA.uid]: settingsA,
    [settingsB.uid]: settingsB,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceInstanceList.mockResolvedValue([settingsA, settingsB].map(toListItem));
    mockGetDataSourceInstanceSettings.mockImplementation(async (ref) =>
      typeof ref === 'string' ? settingsByUid[ref] : undefined
    );
  });

  it('should resolve the full settings for each listed data source, preserving order', async () => {
    const { result } = renderHook(() => useDatasources({}));

    await waitFor(() => expect(result.current).toEqual([settingsA, settingsB]));
  });

  it('should forward the filters to getDataSourceInstanceList', async () => {
    const filters = { alerting: true, type: 'prometheus' };

    renderHook(() => useDatasources(filters));

    await waitFor(() => expect(mockGetDataSourceInstanceList).toHaveBeenCalledWith(filters));
  });

  it('should return the provided data sources without fetching when they are set', async () => {
    const provided = [settingsB];

    const { result } = renderHook(() => useDatasources({}, provided));

    expect(result.current).toBe(provided);
    // Flush microtasks so any fetch would have started by now.
    await act(async () => {});
    expect(mockGetDataSourceInstanceList).not.toHaveBeenCalled();
  });

  it('should re-fetch when the filters change value, but not for a value-equal object', async () => {
    const { rerender } = renderHook(({ filters }) => useDatasources(filters), {
      initialProps: { filters: { alerting: true } },
    });

    await waitFor(() => expect(mockGetDataSourceInstanceList).toHaveBeenCalledTimes(1));

    rerender({ filters: { alerting: true } });
    await act(async () => {});
    expect(mockGetDataSourceInstanceList).toHaveBeenCalledTimes(1);

    rerender({ filters: { alerting: false } });
    await waitFor(() => expect(mockGetDataSourceInstanceList).toHaveBeenCalledTimes(2));
  });

  it('should return an empty array while the lookup is pending', () => {
    // Never resolves so the hook stays in its loading state.
    mockGetDataSourceInstanceList.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDatasources({}));

    expect(result.current).toEqual([]);
  });

  it('should omit data sources whose settings cannot be resolved', async () => {
    mockGetDataSourceInstanceSettings.mockImplementation(async (ref) =>
      ref === settingsA.uid ? settingsA : undefined
    );

    const { result } = renderHook(() => useDatasources({}));

    await waitFor(() => expect(result.current).toEqual([settingsA]));
  });
});
