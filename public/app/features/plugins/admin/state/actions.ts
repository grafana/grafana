import { createAsyncThunk, Update } from '@reduxjs/toolkit';
import { getBackendSrv } from '@grafana/runtime';
import { PanelPlugin } from '@grafana/data';
import { StoreState } from 'app/types';
import { importPanelPlugin } from 'app/features/plugins/plugin_loader';
import { getCatalogPlugins, getPluginDetails, installPlugin, uninstallPlugin } from '../api';
import { STATE_PREFIX } from '../constants';
import { CatalogPlugin } from '../types';

export const fetchAll = createAsyncThunk(`${STATE_PREFIX}/fetchAll`, async (_, thunkApi) => {
  try {
    return await getCatalogPlugins();
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const fetchDetails = createAsyncThunk(`${STATE_PREFIX}/fetchDetails`, async (id: string, thunkApi) => {
  try {
    const details = await getPluginDetails(id);

    return {
      id,
      changes: { details },
    } as Update<CatalogPlugin>;
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const install = createAsyncThunk(
  `${STATE_PREFIX}/install`,
  async ({ id, version, isUpdating = false }: { id: string; version: string; isUpdating?: boolean }, thunkApi) => {
    const changes = isUpdating ? { isInstalled: true, hasUpdate: false } : { isInstalled: true };
    try {
      await installPlugin(id, version);
      return {
        id,
        changes,
      } as Update<CatalogPlugin>;
    } catch (e) {
      // TODO<add more error handling here>
      return thunkApi.rejectWithValue('Unknown error.');
    }
  }
);

export const uninstall = createAsyncThunk(`${STATE_PREFIX}/uninstall`, async (id: string, thunkApi) => {
  try {
    await uninstallPlugin(id);
    return {
      id,
      changes: { isInstalled: false },
    } as Update<CatalogPlugin>;
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

// Action needed for backwards compatibility
// Originally location: public/app/features/plugins/state/actions.ts
// TODO<get rid of this this once the "plugin_admin_enabled" feature flag is removed>
export const loadPluginDashboards = createAsyncThunk(`${STATE_PREFIX}/loadPluginDashboards`, async (_, thunkApi) => {
  const state = thunkApi.getState() as StoreState;
  const dataSourceType = state.dataSources.dataSource.type;
  const url = `api/plugins/${dataSourceType}/dashboards`;

  return getBackendSrv().get(url);
});

// Action needed for backwards compatibility
// Original location: public/app/features/plugins/state/actions.ts
// TODO<get rid of this this once the "plugin_admin_enabled" feature flag is removed>
export const loadPanelPlugin = createAsyncThunk<PanelPlugin, string, { state: StoreState }>(
  `${STATE_PREFIX}/loadPanelPlugin`,
  async (id: string, thunkApi) => {
    const plugin = thunkApi.getState().plugins.panels[id];

    if (!plugin) {
      return importPanelPlugin(id);

      // I don't think it's needed?
      // second check to protect against raise condition
      // if (!state.plugins.panels[id]) {
      //   thunkApi.dispatch(panelPluginLoaded(plugin));
      // }
    }

    return plugin;
  }
);
