import { renderHook, act } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';

import { TestDataSettings } from '../query/state/mocks/mockDataSource';

import { useDatasources, useRecentlyUsedDataSources } from './hooks';

jest.mock('react-use', () => ({
  useLocalStorage: jest.fn(),
}));

const getListMock = jest.fn();
const getAllMock = jest.fn();
const getVariablesMock = jest.fn(() => [] as Array<{ type: string; name: string }>);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: getListMock,
    getAll: getAllMock,
  }),
  getTemplateSrv: () => ({
    getVariables: getVariablesMock,
  }),
}));

const mockUseLocalStorage = jest.requireMock('react-use').useLocalStorage;

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
  const makeDataSourceList = (uids: string[]): DataSourceInstanceSettings[] =>
    uids.map((uid) => ({ ...TestDataSettings, uid, name: uid }) as unknown as DataSourceInstanceSettings);

  beforeEach(() => {
    jest.clearAllMocks();
    getListMock.mockImplementation(() => makeDataSourceList(['a', 'b', 'c']));
    getAllMock.mockImplementation(() => makeDataSourceList(['a', 'b', 'c']));
  });

  it('returns the explicit list unchanged when one is passed, without calling getList', () => {
    const explicit = makeDataSourceList(['x', 'y']);
    const { result } = renderHook(() => useDatasources({ metrics: true }, explicit));
    expect(result.current).toBe(explicit);
    expect(getListMock).not.toHaveBeenCalled();
  });

  it('returns a stable reference across re-renders when filters are value-equal', () => {
    const { result, rerender } = renderHook(({ filters }) => useDatasources(filters), {
      initialProps: { filters: { metrics: true } },
    });
    const first = result.current;
    rerender({ filters: { metrics: true } });
    expect(result.current).toBe(first);
  });

  it('returns a new reference when filter fields change', () => {
    const { result, rerender } = renderHook(({ filters }) => useDatasources(filters), {
      initialProps: { filters: { metrics: true } as { metrics?: boolean; tracing?: boolean } },
    });
    const first = result.current;
    rerender({ filters: { tracing: true } });
    expect(result.current).not.toBe(first);
  });

  it('returns a new reference when the available datasource count changes', () => {
    const { result, rerender } = renderHook(() => useDatasources({ metrics: true }));
    const first = result.current;

    getAllMock.mockImplementation(() => makeDataSourceList(['a', 'b', 'c', 'd']));
    getListMock.mockImplementation(() => makeDataSourceList(['a', 'b', 'c', 'd']));

    rerender();
    expect(result.current).not.toBe(first);
    expect(result.current).toHaveLength(4);
  });

  it('returns the same list that getList(filters) would produce', () => {
    const expected = makeDataSourceList(['a', 'b', 'c']);
    getListMock.mockImplementation(() => expected);
    const { result } = renderHook(() => useDatasources({ metrics: true }));
    expect(result.current.map((ds) => ds.uid)).toEqual(expected.map((ds) => ds.uid));
  });

  it('returns a new reference when datasource template variables change and variables filter is enabled', () => {
    getVariablesMock.mockReturnValue([{ type: 'datasource', name: 'ds1' }]);
    const { result, rerender } = renderHook(() => useDatasources({ variables: true }));
    const first = result.current;

    getVariablesMock.mockReturnValue([
      { type: 'datasource', name: 'ds1' },
      { type: 'datasource', name: 'ds2' },
    ]);

    rerender();
    expect(result.current).not.toBe(first);
  });

  it('ignores template variable changes when variables filter is not enabled', () => {
    getVariablesMock.mockReturnValue([{ type: 'datasource', name: 'ds1' }]);
    const { result, rerender } = renderHook(() => useDatasources({ metrics: true }));
    const first = result.current;

    getVariablesMock.mockReturnValue([
      { type: 'datasource', name: 'ds1' },
      { type: 'datasource', name: 'ds2' },
    ]);

    rerender();
    expect(result.current).toBe(first);
  });

  it('ignores non-datasource template variables', () => {
    getVariablesMock.mockReturnValue([{ type: 'datasource', name: 'ds1' }]);
    const { result, rerender } = renderHook(() => useDatasources({ variables: true }));
    const first = result.current;

    getVariablesMock.mockReturnValue([
      { type: 'datasource', name: 'ds1' },
      { type: 'query', name: 'q1' },
    ]);

    rerender();
    expect(result.current).toBe(first);
  });
});
