import { createAction, createAsyncThunk, type Update } from '@reduxjs/toolkit';
import { from, forkJoin, timeout, lastValueFrom, catchError, of } from 'rxjs';

import { type PanelPlugin, type PluginError } from '@grafana/data';
import { config, getBackendSrv, isFetchError } from '@grafana/runtime';
import { refetchPanelPluginMetas } from '@grafana/runtime/internal';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { type StoreState, type ThunkResult } from 'app/types/store';

import { clearPluginInfoInCache } from '../../loader/pluginInfoCache';
import {
  getRemotePlugins,
  getPluginErrors,
  getLocalPlugins,
  getPluginDetails,
  getPluginInsights,
  installPlugin,
  uninstallPlugin,
  getInstancePlugins,
  getProvisionedPlugins,
} from '../api';
import { STATE_PREFIX } from '../constants';
import { mapLocalToCatalog, mergeLocalsAndRemotes } from '../helpers';
import {
  type CatalogPlugin,
  type RemotePlugin,
  type LocalPlugin,
  type InstancePlugin,
  type ProvisionedPlugin,
  type PluginCatalogStoreState,
  PluginStatus,
} from '../types';

import { selectByIdOrAlias } from './selectors';

// Fetches
export const fetchAll = createAsyncThunk(`${STATE_PREFIX}/fetchAll`, async (_, thunkApi) => {
  try {
    thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/pending` });
    thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/pending` });

    const instance$ = config.pluginAdminExternalManageEnabled ? from(getInstancePlugins()) : of(undefined);
    const provisioned$ = config.pluginAdminExternalManageEnabled ? from(getProvisionedPlugins()) : of(undefined);
    const TIMEOUT = 500;
    const pluginErrors$ = from(getPluginErrors());
    const local$ = from(getLocalPlugins());
    // Unknown error while fetching remote plugins from GCOM.
    // (In this case we still operate, but only with locally available plugins.)
    const remote$ = from(getRemotePlugins()).pipe(
      catchError((err) => {
        thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/rejected` });
        console.error(err);
        return of([]);
      })
    );

    forkJoin({
      local: local$,
      remote: remote$,
      instance: instance$,
      provisioned: provisioned$,
      pluginErrors: pluginErrors$,
    })
      .pipe(
        // Fetching the list of plugins from GCOM is slow / times out
        // (We are waiting for TIMEOUT, and if there is still no response from GCOM we continue with locally
        // installed plugins only by returning a new observable. We also still wait for the remote request to finish or
        // time out, but we don't block the main execution flow.)
        timeout({
          each: TIMEOUT,
          with: () => {
            remote$
              // Remote plugins loaded after a timeout, updating the store
              .subscribe(async (remote: RemotePlugin[]) => {
                thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/fulfilled` });

                if (remote.length > 0) {
                  const local = await lastValueFrom(local$);
                  const instance = await lastValueFrom(instance$);
                  const provisioned = await lastValueFrom(provisioned$);
                  const pluginErrors = await lastValueFrom(pluginErrors$);

                  thunkApi.dispatch(
                    addPlugins(mergeLocalsAndRemotes({ local, remote, instance, provisioned, pluginErrors }))
                  );
                }
              });

            return forkJoin({
              local: local$,
              instance: instance$,
              provisioned: provisioned$,
              pluginErrors: pluginErrors$,
            });
          },
        })
      )
      .subscribe(
        ({
          local,
          remote,
          instance,
          provisioned,
          pluginErrors,
        }: {
          local: LocalPlugin[];
          remote?: RemotePlugin[];
          instance?: InstancePlugin[];
          provisioned?: ProvisionedPlugin[];
          pluginErrors: PluginError[];
        }) => {
          // Both local and remote plugins are loaded
          if (local && remote) {
            thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/fulfilled` });
            thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/fulfilled` });
            thunkApi.dispatch(
              addPlugins(mergeLocalsAndRemotes({ local, remote, instance, provisioned, pluginErrors }))
            );

            // Only remote plugins are loaded (remote timed out)
          } else if (local) {
            thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/fulfilled` });
            thunkApi.dispatch(addPlugins(mergeLocalsAndRemotes({ local, pluginErrors })));
          }
        },
        (error) => {
          console.log(error);
          thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/rejected` });
          thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/rejected` });
          return thunkApi.rejectWithValue('Unknown error.');
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

export const fetchDetails = createAsyncThunk<Update<CatalogPlugin, string>, string, { state: PluginCatalogStoreState }>(
  `${STATE_PREFIX}/fetchDetails`,
  async (id, thunkApi) => {
    try {
      const details = await getPluginDetails(id);
      const canonicalId = selectByIdOrAlias(thunkApi.getState(), id)?.id ?? id;
      return {
        id: canonicalId,
        changes: { details },
      };
    } catch (e) {
      return thunkApi.rejectWithValue('Unknown error.');
    }
  }
);

export const fetchPluginInsights = createAsyncThunk<Update<CatalogPlugin, string>, { id: string; version?: string }>(
  `${STATE_PREFIX}/fetchPluginInsights`,
  async ({ id, version }, thunkApi) => {
    try {
      const insights = await getPluginInsights(id, version);

      return {
        id,
        changes: { insights },
      };
    } catch (e) {
      return thunkApi.rejectWithValue('Unknown error.');
    }
  }
);

export const addPlugins = createAction<CatalogPlugin[]>(`${STATE_PREFIX}/addPlugins`);

// We are also using the install API endpoint to update the plugin
export const install = createAsyncThunk<
  Update<CatalogPlugin, string>,
  {
    id: string;
    version?: string;
    installType?: PluginStatus;
  }
>(`${STATE_PREFIX}/install`, async ({ id, version, installType = PluginStatus.INSTALL }, thunkApi) => {
  const changes: Partial<CatalogPlugin> = { isInstalled: true, installedVersion: version };

  if (installType === PluginStatus.UPDATE) {
    changes.hasUpdate = false;
  }
  if (installType === PluginStatus.DOWNGRADE) {
    changes.hasUpdate = true;
  }

  try {
    await installPlugin(id, version);
    await refetchPanelPluginMetas();

    if (installType !== PluginStatus.INSTALL) {
      clearPluginInfoInCache(id);
    }

    return { id, changes };
  } catch (e) {
    console.error(e);
    if (isFetchError(e)) {
      // add id to identify errors in multiple requests
      e.data.id = id;
      return thunkApi.rejectWithValue(e.data);
    }

    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const unsetInstall = createAsyncThunk(`${STATE_PREFIX}/install`, async () => ({}));

export const uninstall = createAsyncThunk<Update<CatalogPlugin, string>, string>(
  `${STATE_PREFIX}/uninstall`,
  async (id, thunkApi) => {
    try {
      await uninstallPlugin(id);
      await refetchPanelPluginMetas();

      clearPluginInfoInCache(id);

      return {
        id,
        changes: { isInstalled: false, installedVersion: undefined, isFullyInstalled: false },
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
    const state = getStore();
    let plugin = state.plugins.panels[id];

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
