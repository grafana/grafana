import { useEffect, useMemo } from 'react';

import { PluginError, PluginType } from '@grafana/data';
import { useDispatch, useSelector } from 'app/types';

import { sortPlugins, Sorters, isPluginUpdatable } from '../helpers';
import { CatalogPlugin, PluginStatus } from '../types';

import { fetchAll, fetchDetails, fetchRemotePlugins, install, uninstall, fetchAllLocal, unsetInstall } from './actions';
import {
  selectPlugins,
  selectById,
  selectIsRequestPending,
  selectRequestError,
  selectIsRequestNotFetched,
  selectPluginErrors,
  type PluginFilters,
} from './selectors';

export const useGetAll = (filters: PluginFilters, sortBy: Sorters = Sorters.nameAsc) => {
  useFetchAll();

  const selector = useMemo(() => selectPlugins(filters), [filters]);
  const plugins = useSelector(selector);
  // As the locally installed plugins load quicker than the remote ones, we only show a loading state until these are being loaded
  // (In case the remote ones are not loaded within a reasonable timeout, we will merge those with the locally installed plugins once they are loaded)
  const { isLoading, error } = useLocalFetchStatus();
  const sortedPlugins = sortPlugins(plugins, sortBy);

  return {
    isLoading,
    error,
    plugins: sortedPlugins,
  };
};

export const useGetUpdatable = () => {
  const { isLoading } = useFetchStatus();
  const { plugins: installed } = useGetAll({ isInstalled: true });
  const updatablePlugins = installed.filter(isPluginUpdatable);
  return {
    isLoading,
    updatablePlugins,
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

export const useGetErrors = (filterByPluginType?: PluginType): PluginError[] => {
  useFetchAll();

  return useSelector(selectPluginErrors(filterByPluginType));
};

export const useInstall = () => {
  const dispatch = useDispatch();
  return (id: string, version?: string, installType?: PluginStatus) => dispatch(install({ id, version, installType }));
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

export const useLocalFetchStatus = () => {
  const isLoading = useSelector(selectIsRequestPending('plugins/fetchLocal'));
  const error = useSelector(selectRequestError('plugins/fetchLocal'));

  return { isLoading, error };
};

export const useFetchStatus = () => {
  const isAllLoading = useSelector(selectIsRequestPending(fetchAll.typePrefix));
  const isLocalLoading = useSelector(selectIsRequestPending('plugins/fetchLocal'));
  const isRemoteLoading = useSelector(selectIsRequestPending('plugins/fetchRemote'));
  const isLoading = isAllLoading || isLocalLoading || isRemoteLoading;
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

export const useFetchDetailsLazy = () => {
  const dispatch = useDispatch();

  return (id: string) => dispatch(fetchDetails(id));
};
