import { renderHook, act, waitFor } from '@testing-library/react';

import { DataSourceInstanceSettings, DataSourcePluginMeta, PluginType, PluginMetaInfo } from '@grafana/data';

import { useFavoriteDatasources } from './useFavoriteDatasources';

// Mock UserStorage
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('./userStorage', () => {
  return {
    UserStorage: jest.fn().mockImplementation(() => ({
      getItem: (key: string) => mockGetItem(key),
      setItem: (key: string, value: string) => mockSetItem(key, value),
    })),
  };
});

jest.mock('../config', () => {
  return {
    config: {
      featureToggles: {
        favoriteDatasources: true,
      },
    },
  };
});

describe('useFavoriteDatasources', () => {
  // Test data helpers
  const pluginMetaInfo: PluginMetaInfo = {
    author: { name: '', url: '' },
    description: '',
    version: '',
    updated: '',
    links: [],
    logos: { small: '', large: '' },
    screenshots: [],
  };

  function createPluginMeta(name: string, builtIn: boolean): DataSourcePluginMeta {
    return {
      builtIn,
      name,
      id: name,
      type: PluginType.datasource,
      baseUrl: '',
      info: pluginMetaInfo,
      module: '',
    };
  }

  function createDataSource(name: string, id: number, builtIn = false): DataSourceInstanceSettings {
    return {
      name: name,
      uid: `${name}-uid`,
      meta: createPluginMeta(name, builtIn),
      id,
      access: 'direct',
      jsonData: {},
      type: name,
      readOnly: false,
    };
  }

  const mockDS1 = createDataSource('prometheus', 1);
  const mockBuiltInDS = createDataSource('grafana', 4, true);

  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initial loading', () => {
    it('should initialize with empty favorites when no stored data exists', async () => {
      mockGetItem.mockResolvedValue(null);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual([]);
        expect(result.current.initialFavoriteDataSources).toEqual([]);
      });

      expect(mockGetItem).toHaveBeenCalledWith('favoriteDatasources');
    });

    it('should load existing favorites from storage', async () => {
      const storedFavorites = ['prometheus-uid', 'loki-uid'];
      mockGetItem.mockResolvedValue(JSON.stringify(storedFavorites));

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(storedFavorites);
        expect(result.current.initialFavoriteDataSources).toEqual(storedFavorites);
      });
    });

    it('should handle non-array data in storage gracefully', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ not: 'an array' }));

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual([]);
        expect(result.current.initialFavoriteDataSources).toEqual([]);
      });
    });
  });

  describe('addFavoriteDatasource', () => {
    it('should add a new datasource to favorites', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));
      mockSetItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual([]);
      });

      act(() => {
        result.current.addFavoriteDatasource(mockDS1);
      });

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['prometheus-uid']);
        expect(result.current.initialFavoriteDataSources).toEqual([]);
      });

      expect(mockSetItem).toHaveBeenCalledWith('favoriteDatasources', JSON.stringify(['prometheus-uid']));
    });

    it('should not add duplicate datasources', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(['prometheus-uid']));
      mockSetItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['prometheus-uid']);
      });

      act(() => {
        result.current.addFavoriteDatasource(mockDS1);
      });

      // Should not change
      expect(result.current.favoriteDatasources).toEqual(['prometheus-uid']);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('should not add built-in datasources', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));
      mockSetItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual([]);
      });

      act(() => {
        result.current.addFavoriteDatasource(mockBuiltInDS);
      });

      // Should not change
      expect(result.current.favoriteDatasources).toEqual([]);
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe('removeFavoriteDatasource', () => {
    it('should remove a datasource from favorites', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(['prometheus-uid', 'loki-uid']));
      mockSetItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['prometheus-uid', 'loki-uid']);
      });

      act(() => {
        result.current.removeFavoriteDatasource(mockDS1);
      });

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['loki-uid']);
      });

      expect(mockSetItem).toHaveBeenCalledWith('favoriteDatasources', JSON.stringify(['loki-uid']));
    });

    it('should handle removing non-existent datasource gracefully', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(['loki-uid']));
      mockSetItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['loki-uid']);
      });

      act(() => {
        result.current.removeFavoriteDatasource(mockDS1); // prometheus not in list
      });

      // Should not change or call setItem since nothing was removed
      expect(result.current.favoriteDatasources).toEqual(['loki-uid']);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('should remove all datasources when removing the last one', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(['prometheus-uid']));
      mockSetItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['prometheus-uid']);
      });

      act(() => {
        result.current.removeFavoriteDatasource(mockDS1);
      });

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual([]);
      });

      expect(mockSetItem).toHaveBeenCalledWith('favoriteDatasources', JSON.stringify([]));
    });
  });

  describe('isFavoriteDatasource', () => {
    it('should return true for favorited datasource', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(['prometheus-uid', 'loki-uid']));

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['prometheus-uid', 'loki-uid']);
      });

      expect(result.current.isFavoriteDatasource('prometheus-uid')).toBe(true);
      expect(result.current.isFavoriteDatasource('loki-uid')).toBe(true);
    });

    it('should return false for non-favorited datasource', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(['prometheus-uid']));

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual(['prometheus-uid']);
      });

      expect(result.current.isFavoriteDatasource('loki-uid')).toBe(false);
      expect(result.current.isFavoriteDatasource('elasticsearch-uid')).toBe(false);
    });

    it('should return false when no favorites exist', async () => {
      mockGetItem.mockResolvedValue(null);

      const { result } = renderHook(() => useFavoriteDatasources());

      await waitFor(() => {
        expect(result.current.favoriteDatasources).toEqual([]);
      });

      expect(result.current.isFavoriteDatasource('prometheus-uid')).toBe(false);
    });
  });
});
