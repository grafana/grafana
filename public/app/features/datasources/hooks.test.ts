import { renderHook, act } from '@testing-library/react';

import { TestDataSettings } from '../query/state/mocks/mockDataSource';

import { useRecentlyUsedDataSources } from './hooks';

// Mock react-use's useLocalStorage
jest.mock('react-use', () => ({
  useLocalStorage: jest.fn(),
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
