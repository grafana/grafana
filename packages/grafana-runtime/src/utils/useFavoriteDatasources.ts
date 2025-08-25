import { useCallback, useEffect, useState } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';

import { config } from '../config';

import { UserStorage } from './userStorage';

const FAVORITE_DATASOURCES_KEY = 'favoriteDatasources';

export type FavoriteDatasources = {
  enabled: boolean;
  isLoading: boolean;
  favoriteDatasources: string[];
  initialFavoriteDataSources: string[];
  addFavoriteDatasource: (ds: DataSourceInstanceSettings) => void;
  removeFavoriteDatasource: (ds: DataSourceInstanceSettings) => void;
  isFavoriteDatasource: (dsUid: string) => boolean;
};

// Initialize user storage as a singleton
const userStorage = new UserStorage('grafana-runtime');

/**
 * A hook for managing favorite data sources using user storage.
 * This hook provides functionality to store and retrieve a list of favorite data source UIDs
 * using the backend user storage (with localStorage fallback).
 *
 * @returns An object containing:
 * - A boolean indicating if the feature is enabled
 * - An array of favorite data source UIDs
 * - An array of favorite data source UIDs that were initially loaded from storage
 * - A function to add a data source to favorites
 * - A function to remove a data source from favorites
 * - A function to check if a data source is favorited
 * @public
 */
export function useFavoriteDatasources(): FavoriteDatasources {
  const [favoriteDatasources, setFavoriteDatasources] = useState<string[]>([]);
  const [initialFavoriteDataSources, setInitialFavoriteDataSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load favorites from storage on mount
  useEffect(() => {
    const loadFavorites = async () => {
      setIsLoading(true);
      const stored = await userStorage.getItem(FAVORITE_DATASOURCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavoriteDatasources(parsed);
        setInitialFavoriteDataSources(parsed);
      }
      setIsLoading(false);
    };

    loadFavorites();
  }, []);

  // Helper function to save favorites to storage
  const saveFavorites = useCallback(async (newFavorites: string[]) => {
    setIsLoading(true);
    await userStorage.setItem(FAVORITE_DATASOURCES_KEY, JSON.stringify(newFavorites));
    setFavoriteDatasources(newFavorites);
    setIsLoading(false);
  }, []);

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

  if (!config.featureToggles.favoriteDatasources) {
    return {
      enabled: false,
      isLoading: false,
      favoriteDatasources: [],
      initialFavoriteDataSources: [],
      addFavoriteDatasource: () => {},
      removeFavoriteDatasource: () => {},
      isFavoriteDatasource: () => false,
    };
  }

  return {
    enabled: true,
    isLoading,
    favoriteDatasources,
    addFavoriteDatasource,
    removeFavoriteDatasource,
    isFavoriteDatasource,
    initialFavoriteDataSources,
  };
}
