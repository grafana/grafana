import { createAction, createAsyncThunk, Update } from '@reduxjs/toolkit';
import { from, forkJoin, timeout, lastValueFrom, catchError, throwError } from 'rxjs';

import { PanelPlugin, PluginError } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { StoreState, ThunkResult } from 'app/types';

import { invalidatePluginInCache } from '../../loader/cache';
import {
  getRemotePlugins,
  getPluginErrors,
  getLocalPlugins,
  getPluginDetails,
  installPlugin,
  uninstallPlugin,
} from '../api';
import { STATE_PREFIX } from '../constants';
import { mapLocalToCatalog, mergeLocalsAndRemotes, updatePanels } from '../helpers';
import { CatalogPlugin, RemotePlugin, LocalPlugin } from '../types';

// Fetches
export const fetchAll = createAsyncThunk(`${STATE_PREFIX}/fetchAll`, async (_, thunkApi) => {
  try {
    thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/pending` });
    thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/pending` });

    const local$ = from(getLocalPlugins());
    const remote$ = from(getRemotePlugins());
    const pluginErrors$ = from(getPluginErrors());

    forkJoin({
      local: local$,
      remote: remote$,
      pluginErrors: pluginErrors$,
    })
      .pipe(
        // Fetching the list of plugins from GCOM is slow / errors out
        timeout({
          each: 500,
          with: () => {
            remote$
              // The request to fetch remote plugins from GCOM failed
              .pipe(
                catchError((err) => {
                  thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/rejected` });
                  return throwError(
                    () => new Error('Failed to fetch plugins from catalog (default https://grafana.com/api/plugins)')
                  );
                })
              )
              // Remote plugins loaded after a timeout, updating the store
              .subscribe(async (remote: RemotePlugin[]) => {
                thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/fulfilled` });

                if (remote.length > 0) {
                  const local = await lastValueFrom(local$);
                  const pluginErrors = await lastValueFrom(pluginErrors$);

                  thunkApi.dispatch(addPlugins(mergeLocalsAndRemotes(local, remote, pluginErrors)));
                }
              });

            return forkJoin({ local: local$, pluginErrors: pluginErrors$ });
          },
        })
      )
      .subscribe(
        ({
          local,
          remote,
          pluginErrors,
        }: {
          local: LocalPlugin[];
          remote?: RemotePlugin[];
          pluginErrors: PluginError[];
        }) => {
          thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/fulfilled` });

          // Both local and remote plugins are loaded
          if (local && remote) {
            thunkApi.dispatch(addPlugins(mergeLocalsAndRemotes(local, remote, pluginErrors)));

            // Only remote plugins are loaded (remote timed out)
          } else if (local) {
            thunkApi.dispatch(addPlugins(mergeLocalsAndRemotes(local, [], pluginErrors)));
          }
        }
      );

    return null;
  } catch (e) {
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const fetchAllLocal = createAsyncThunk(`${STATE_PREFIX}/fetchAllLocal`, async (_, thunkApi) => {
  try {
    const localPlugins = await getLocalPlugins();
    return localPlugins.map((plugin: LocalPlugin) => mapLocalToCatalog(plugin));
  } catch (e) {
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const fetchRemotePlugins = createAsyncThunk<RemotePlugin[], void, { rejectValue: RemotePlugin[] }>(
  `${STATE_PREFIX}/fetchRemotePlugins`,
  async (_, thunkApi) => {
    try {
      return await getRemotePlugins();
    } catch (error) {
      if (isFetchError(error)) {
        error.isHandled = true;
      }
      return thunkApi.rejectWithValue([]);
    }
  }
);

export const fetchDetails = createAsyncThunk<Update<CatalogPlugin>, string>(
  `${STATE_PREFIX}/fetchDetails`,
  async (id: string, thunkApi) => {
    try {
      const details = await getPluginDetails(id);

      return {
        id,
        changes: { details },
      };
    } catch (e) {
      return thunkApi.rejectWithValue('Unknown error.');
    }
  }
);

export const addPlugins = createAction<CatalogPlugin[]>(`${STATE_PREFIX}/addPlugins`);

// 1. gets remote equivalents from the store (if there are any)
// 2. merges the remote equivalents with the local plugins
// 3. updates the the store with the updated CatalogPlugin objects
export const addLocalPlugins = createAction<LocalPlugin[]>(`${STATE_PREFIX}/addLocalPlugins`);

// 1. gets local equivalents from the store (if there are any)
// 2. merges the local equivalents with the remote plugins
// 3. updates the the store with the updated CatalogPlugin objects
export const addRemotePlugins = createAction<RemotePlugin[]>(`${STATE_PREFIX}/addLocalPlugins`);

// 1. merges the local and remote plugins
// 2. updates the store with the CatalogPlugin objects
export const addLocalAndRemotePlugins = createAction<{ local: LocalPlugin[]; remote: RemotePlugin[] }>(
  `${STATE_PREFIX}/addLocalPlugins`
);

// We are also using the install API endpoint to update the plugin
export const install = createAsyncThunk<
  Update<CatalogPlugin>,
  {
    id: string;
    version?: string;
    isUpdating?: boolean;
  }
>(`${STATE_PREFIX}/install`, async ({ id, version, isUpdating = false }, thunkApi) => {
  const changes = isUpdating
    ? { isInstalled: true, installedVersion: version, hasUpdate: false }
    : { isInstalled: true, installedVersion: version };
  try {
    await installPlugin(id);
    await updatePanels();

    if (isUpdating) {
      invalidatePluginInCache(id);
    }

    return { id, changes };
  } catch (e) {
    console.error(e);
    if (isFetchError(e)) {
      return thunkApi.rejectWithValue(e.data);
    }

    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const unsetInstall = createAsyncThunk(`${STATE_PREFIX}/install`, async () => ({}));

export const uninstall = createAsyncThunk<Update<CatalogPlugin>, string>(
  `${STATE_PREFIX}/uninstall`,
  async (id, thunkApi) => {
    try {
      await uninstallPlugin(id);
      await updatePanels();

      invalidatePluginInCache(id);

      return {
        id,
        changes: { isInstalled: false, installedVersion: undefined },
      };
    } catch (e) {
      console.error(e);

      return thunkApi.rejectWithValue('Unknown error.');
    }
  }
);

// We need this to be backwards-compatible with other parts of Grafana.
// (Originally in "public/app/features/plugins/state/actions.ts")
// TODO<remove once the "plugin_admin_enabled" feature flag is removed>
export const loadPluginDashboards = createAsyncThunk(`${STATE_PREFIX}/loadPluginDashboards`, async (_, thunkApi) => {
  const state = thunkApi.getState() as StoreState;
  const dataSourceType = state.dataSources.dataSource.type;
  const url = `api/plugins/${dataSourceType}/dashboards`;

  return getBackendSrv().get(url);
});

export const panelPluginLoaded = createAction<PanelPlugin>(`${STATE_PREFIX}/panelPluginLoaded`);

// We need this to be backwards-compatible with other parts of Grafana.
// (Originally in "public/app/features/plugins/state/actions.ts")
// It cannot be constructed with `createAsyncThunk()` as we need the return value on the call-site,
// and we cannot easily change the call-site to unwrap the result.
// TODO<remove once the "plugin_admin_enabled" feature flag is removed>
export const loadPanelPlugin = (id: string): ThunkResult<Promise<PanelPlugin>> => {
  return async (dispatch, getStore) => {
    let plugin = getStore().plugins.panels[id];

    if (!plugin) {
      plugin = await importPanelPlugin(id);

      // second check to protect against raise condition
      if (!getStore().plugins.panels[id]) {
        dispatch(panelPluginLoaded(plugin));
      }
    }

    return plugin;
  };
};
