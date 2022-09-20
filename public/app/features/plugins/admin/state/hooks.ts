import { useEffect } from 'react';

import { PluginError } from '@grafana/data';
import { useDispatch, useSelector } from 'app/types';

import { sortPlugins, Sorters } from '../helpers';
import { CatalogPlugin, PluginListDisplayMode } from '../types';

import { fetchAll, fetchDetails, fetchRemotePlugins, install, uninstall } from './actions';
import { setDisplayMode } from './reducer';
import {
  find,
  selectAll,
  selectById,
  selectIsRequestPending,
  selectRequestError,
  selectIsRequestNotFetched,
  selectDisplayMode,
  selectPluginErrors,
} from './selectors';

type Filters = {
  query?: string; // Note: this will be an escaped regex string as it comes from `FilterInput`
  filterBy?: string;
  filterByType?: string;
  sortBy?: Sorters;
};

export const useGetAllWithFilters = ({
  query = '',
  filterBy = 'installed',
  filterByType = 'all',
  sortBy = Sorters.nameAsc,
}: Filters) => {
  useFetchAll();

  const filtered = useSelector(find(query, filterBy, filterByType));
  const { isLoading, error } = useFetchStatus();
  const sortedAndFiltered = sortPlugins(filtered, sortBy);

  return {
    isLoading,
    error,
    plugins: sortedAndFiltered,
  };
};

export const useGetAll = (): CatalogPlugin[] => {
  useFetchAll();

  return useSelector(selectAll);
};

export const useGetSingle = (id: string): CatalogPlugin | undefined => {
  useFetchAll();
  useFetchDetails(id);

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
