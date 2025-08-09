import { useCallback, useEffect, useState } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';

import { UserStorage } from './userStorage';

const FAVORITE_DATASOURCES_KEY = 'favoriteDatasources';

/**
 * A hook for managing favorite data sources using user storage.
 * This hook provides functionality to store and retrieve a list of favorite data source UIDs
 * using the backend user storage (with localStorage fallback).
 *
 * @returns An object containing:
 * - An array of favorite data source UIDs
 * - An array of favorite data source UIDs that were initially loaded from storage
 * - A function to add a data source to favorites
 * - A function to remove a data source from favorites
 * - A function to check if a data source is favorited
 * - A function to toggle a data source's favorite status
 * @public
 */
export function useFavoriteDatasources(): {
  favoriteDatasources: string[];
  initialFavoriteDataSources: string[];
  addFavoriteDatasource: (ds: DataSourceInstanceSettings) => void;
  removeFavoriteDatasource: (ds: DataSourceInstanceSettings) => void;
  isFavoriteDatasource: (dsUid: string) => boolean;
  toggleFavoriteDatasource: (ds: DataSourceInstanceSettings) => void;
} {
  const [userStorage] = useState(() => new UserStorage('grafana-runtime'));
  const [favoriteDatasources, setFavoriteDatasources] = useState<string[]>([]);
  const [initialFavoriteDataSources, setInitialFavoriteDataSources] = useState<string[]>([]);

  // Load favorites from storage on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const stored = await userStorage.getItem(FAVORITE_DATASOURCES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setFavoriteDatasources(parsed);
            setInitialFavoriteDataSources(parsed);
          }
        }
      } catch (error) {
        console.warn('Failed to load favorite data sources:', error);
        setFavoriteDatasources([]);
      }
    };

    loadFavorites();
  }, [userStorage]);

  // Helper function to save favorites to storage
  const saveFavorites = useCallback(
    async (newFavorites: string[]) => {
      try {
        await userStorage.setItem(FAVORITE_DATASOURCES_KEY, JSON.stringify(newFavorites));
        setFavoriteDatasources(newFavorites);
      } catch (error) {
        console.warn('Failed to save favorite data sources:', error);
      }
    },
    [userStorage]
  );

  const addFavoriteDatasource = useCallback(
    (ds: DataSourceInstanceSettings) => {
      if (ds.meta.builtIn) {
        // Prevent storing built-in datasources (-- Grafana --, -- Mixed --, -- Dashboard --)
        return;
      }

      if (!favoriteDatasources.includes(ds.uid)) {
        const newFavorites = [...favoriteDatasources, ds.uid];
        saveFavorites(newFavorites);
      }
    },
    [favoriteDatasources, saveFavorites]
  );

  const removeFavoriteDatasource = useCallback(
    (ds: DataSourceInstanceSettings) => {
      const newFavorites = favoriteDatasources.filter((uid) => uid !== ds.uid);
      if (newFavorites.length !== favoriteDatasources.length) {
        saveFavorites(newFavorites);
      }
    },
    [favoriteDatasources, saveFavorites]
  );

  const isFavoriteDatasource = useCallback(
    (dsUid: string) => {
      return favoriteDatasources.includes(dsUid);
    },
    [favoriteDatasources]
  );

  const toggleFavoriteDatasource = useCallback(
    (ds: DataSourceInstanceSettings) => {
      if (isFavoriteDatasource(ds.uid)) {
        removeFavoriteDatasource(ds);
      } else {
        addFavoriteDatasource(ds);
      }
    },
    [isFavoriteDatasource, addFavoriteDatasource, removeFavoriteDatasource]
  );

  return {
    favoriteDatasources,
    addFavoriteDatasource,
    removeFavoriteDatasource,
    isFavoriteDatasource,
    initialFavoriteDataSources,
    toggleFavoriteDatasource,
  };
}
