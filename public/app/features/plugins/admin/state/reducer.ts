import { createSlice, createEntityAdapter, Reducer, AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { PanelPlugin } from '@grafana/data';

import { STATE_PREFIX } from '../constants';
import { CatalogPlugin, ReducerState, RequestStatus } from '../types';

import {
  fetchDetails,
  install,
  uninstall,
  loadPluginDashboards,
  panelPluginLoaded,
  fetchAllLocal,
  addPlugins,
} from './actions';

export const pluginsAdapter = createEntityAdapter<CatalogPlugin>();

const isPendingRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/pending`).test(action.type);

const isFulfilledRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/fulfilled`).test(action.type);

const isRejectedRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/rejected`).test(action.type);

// Extract the trailing '/pending', '/rejected', or '/fulfilled'
const getOriginalActionType = (type: string) => {
  const separator = type.lastIndexOf('/');

  return type.substring(0, separator);
};

export const initialState: ReducerState = {
  items: pluginsAdapter.getInitialState(),
  requests: {},

  // Backwards compatibility
  // (we need to have the following fields in the store as well to be backwards compatible with other parts of Grafana)
  // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
  plugins: [],
  errors: [],
  searchQuery: '',
  hasFetched: false,
  dashboards: [],
  isLoadingPluginDashboards: false,
  panels: {},
};

const slice = createSlice({
  name: 'plugins',
  initialState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(addPlugins, (state, action: PayloadAction<CatalogPlugin[]>) => {
        pluginsAdapter.upsertMany(state.items, action.payload);
      })
      // Fetch All local
      .addCase(fetchAllLocal.fulfilled, (state, action) => {
        pluginsAdapter.upsertMany(state.items, action.payload);
      })
      // Fetch Details
      .addCase(fetchDetails.fulfilled, (state, action) => {
        pluginsAdapter.updateOne(state.items, action.payload);
      })
      // Install
      .addCase(install.fulfilled, (state, action) => {
        pluginsAdapter.updateOne(state.items, action.payload);
      })
      // Uninstall
      .addCase(uninstall.fulfilled, (state, action) => {
        pluginsAdapter.updateOne(state.items, action.payload);
      })
      // Load a panel plugin (backward-compatibility)
      // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
      .addCase(panelPluginLoaded, (state, action: PayloadAction<PanelPlugin>) => {
        state.panels[action.payload.meta.id] = action.payload;
      })
      // Start loading panel dashboards (backward-compatibility)
      // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
      .addCase(loadPluginDashboards.pending, (state, action) => {
        state.isLoadingPluginDashboards = true;
        state.dashboards = [];
      })
      // Load panel dashboards (backward-compatibility)
      // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
      .addCase(loadPluginDashboards.fulfilled, (state, action) => {
        state.isLoadingPluginDashboards = false;
        // eslint-disable-next-line
        state.dashboards = action.payload as any; // WritableDraft<PluginDashboard>[],...>
      })
      .addMatcher(isPendingRequest, (state, action) => {
        state.requests[getOriginalActionType(action.type)] = {
          status: RequestStatus.Pending,
        };
      })
      .addMatcher(isFulfilledRequest, (state, action) => {
        state.requests[getOriginalActionType(action.type)] = {
          status: RequestStatus.Fulfilled,
        };
      })
      .addMatcher(isRejectedRequest, (state, action: PayloadAction) => {
        state.requests[getOriginalActionType(action.type)] = {
          status: RequestStatus.Rejected,
          error: action.payload,
        };
      }),
});

export const reducer: Reducer<ReducerState, AnyAction> = slice.reducer;
