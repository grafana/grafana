import { useEffect, useMemo } from 'react';

import { PluginError } from '@grafana/data';
import { useDispatch, useSelector } from 'app/types';

import { sortPlugins, Sorters } from '../helpers';
import { CatalogPlugin, PluginListDisplayMode } from '../types';

import { fetchAll, fetchDetails, fetchRemotePlugins, install, uninstall, fetchAllLocal, unsetInstall } from './actions';
import { setDisplayMode } from './reducer';
import {
  selectPlugins,
  selectById,
  selectIsRequestPending,
  selectRequestError,
  selectIsRequestNotFetched,
  selectDisplayMode,
  selectPluginErrors,
  type PluginFilters,
} from './selectors';

export const useGetAll = (filters: PluginFilters, sortBy: Sorters = Sorters.nameAsc) => {
  useFetchAll();

  const selector = useMemo(() => selectPlugins(filters), [filters]);
  const plugins = useSelector(selector);
  const { isLoading, error } = useFetchStatus();
  const sortedPlugins = sortPlugins(plugins, sortBy);

  return {
    isLoading,
    error,
    plugins: sortedPlugins,
  };
};

export const useGetSingle = (id: string): CatalogPlugin | undefined => {
  useFetchAll();
  useFetchDetails(id);

  return useSelector((state) => selectById(state, id));
};

export const useGetSingleLocalWithoutDetails = (id: string): CatalogPlugin | undefined => {
  useFetchAllLocal();
  return useSelector((state) => selectById(state, id));
};

export const useGetErrors = (): PluginError[] => {
  useFetchAll();

  return useSelector(selectPluginErrors);
};

export const useInstall = () => {
  const dispatch = useDispatch();
  return (id: string, version?: string, isUpdating?: boolean) => dispatch(install({ id, version, isUpdating }));
};

export const useUnsetInstall = () => {
  const dispatch = useDispatch();

  return () => dispatch(unsetInstall());
};

export const useUninstall = () => {
  const dispatch = useDispatch();

  return (id: string) => dispatch(uninstall(id));
};

export const useIsRemotePluginsAvailable = () => {
  const error = useSelector(selectRequestError(fetchRemotePlugins.typePrefix));
  return error === null;
};

export const useFetchStatus = () => {
  const isLoading = useSelector(selectIsRequestPending(fetchAll.typePrefix));
  const error = useSelector(selectRequestError(fetchAll.typePrefix));

  return { isLoading, error };
};

export const useFetchDetailsStatus = () => {
  const isLoading = useSelector(selectIsRequestPending(fetchDetails.typePrefix));
  const error = useSelector(selectRequestError(fetchDetails.typePrefix));

  return { isLoading, error };
};

export const useInstallStatus = () => {
  const isInstalling = useSelector(selectIsRequestPending(install.typePrefix));
  const error = useSelector(selectRequestError(install.typePrefix));

  return { isInstalling, error };
};

export const useUninstallStatus = () => {
  const isUninstalling = useSelector(selectIsRequestPending(uninstall.typePrefix));
  const error = useSelector(selectRequestError(uninstall.typePrefix));

  return { isUninstalling, error };
};

// Only fetches in case they were not fetched yet
export const useFetchAll = () => {
  const dispatch = useDispatch();
  const isNotFetched = useSelector(selectIsRequestNotFetched(fetchAll.typePrefix));

  useEffect(() => {
    isNotFetched && dispatch(fetchAll());
  }, []); // eslint-disable-line
};

// Only fetches in case they were not fetched yet
export const useFetchAllLocal = () => {
  const dispatch = useDispatch();
  const isNotFetched = useSelector(selectIsRequestNotFetched(fetchAllLocal.typePrefix));

  useEffect(() => {
    isNotFetched && dispatch(fetchAllLocal());
  }, []); // eslint-disable-line
};

export const useFetchDetails = (id: string) => {
  const dispatch = useDispatch();
  const plugin = useSelector((state) => selectById(state, id));
  const isNotFetching = !useSelector(selectIsRequestPending(fetchDetails.typePrefix));
  const shouldFetch = isNotFetching && plugin && !plugin.details;

  useEffect(() => {
    shouldFetch && dispatch(fetchDetails(id));
  }, [plugin]); // eslint-disable-line
};

export const useDisplayMode = () => {
  const dispatch = useDispatch();
  const displayMode = useSelector(selectDisplayMode);

  return {
    displayMode,
    setDisplayMode: (v: PluginListDisplayMode) => dispatch(setDisplayMode(v)),
  };
};
