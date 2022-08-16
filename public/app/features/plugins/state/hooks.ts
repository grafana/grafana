import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { PluginCatalogStoreState, PluginListDisplayMode } from '../../types';
import { sortPlugins, Sorters } from '../helpers';

import { fetchAll, fetchRemotePlugins, fetchSingle, install, uninstall } from './actions';
import { setDisplayMode } from './reducer';
import {
  find,
  selectById,
  selectIsRequestPending,
  selectRequestError,
  selectIsRequestNotFetched,
  selectDisplayMode,
  selectPluginErrors,
} from './selectors';

type Filters = {
  query?: string;
  filterBy?: string;
  filterByType?: string;
  sortBy?: Sorters;
};

// Returns the list of plugins.
// (Also fetches the plugins if needed)
export const useGetPlugins = ({
  query = '',
  filterBy = 'installed',
  filterByType = 'all',
  sortBy = Sorters.nameAsc,
}: Filters = {}) => {
  const dispatch = useDispatch();
  const { typePrefix } = fetchAll;
  const plugins = useSelector(find(query, filterBy, filterByType));
  const error = useSelector(selectRequestError(typePrefix));
  const isNotFetched = useSelector(selectIsRequestNotFetched(typePrefix));
  const isPending = useSelector(selectIsRequestPending(typePrefix));

  useEffect(() => {
    isNotFetched && dispatch(fetchAll());
  }, [isNotFetched, dispatch]);

  return { plugins: sortPlugins(plugins, sortBy), error, loading: isPending };
};

// Returns a single plugin by id.
// (Also fetches the plugin if needed)
export const useGetPlugin = (id: string) => {
  const dispatch = useDispatch();
  const { typePrefix } = fetchSingle;
  const plugin = useSelector((state: PluginCatalogStoreState) => selectById(state, id));
  const error = useSelector(selectRequestError(typePrefix));
  const isPending = useSelector(selectIsRequestPending(typePrefix));
  const isNotFetched = useSelector(selectIsRequestNotFetched(typePrefix));
  const isDetailsMissing = !plugin?.settings.module || !plugin.settings.baseUrl || !plugin.readme;
  const shouldFetch = isNotFetched || isDetailsMissing;

  useEffect(() => {
    shouldFetch && dispatch(fetchSingle(id));
  }, [shouldFetch, dispatch, id]);

  return { plugin, error, loading: isPending || shouldFetch };
};

// Returns all plugin related errors
export const useGetErrors = () => {
  const { loading } = useGetPlugins();
  const errors = useSelector(selectPluginErrors);

  return { errors, loading };
};

export const useInstall = () => {
  const dispatch = useDispatch();
  const { typePrefix } = install;
  const loading = useSelector(selectIsRequestPending(typePrefix));
  const error = useSelector(selectRequestError(typePrefix));
  const callback = (id: string, version?: string, isUpdating?: boolean) =>
    dispatch(install({ id, version, isUpdating }));

  return {
    install: callback,
    loading,
    error,
  };
};

export const useUninstall = () => {
  const dispatch = useDispatch();
  const { typePrefix } = uninstall;
  const loading = useSelector(selectIsRequestPending(typePrefix));
  const error = useSelector(selectRequestError(typePrefix));
  const callback = (id: string) => dispatch(uninstall(id));

  return {
    uninstall: callback,
    loading,
    error,
  };
};

// TODO: remove this from the store
export const useIsRemotePluginsAvailable = () => {
  const error = useSelector(selectRequestError(fetchRemotePlugins.typePrefix));
  return error === null;
};

export const useDisplayMode = () => {
  const dispatch = useDispatch();
  const displayMode = useSelector(selectDisplayMode);

  return {
    displayMode,
    setDisplayMode: (v: PluginListDisplayMode) => dispatch(setDisplayMode(v)),
  };
};
