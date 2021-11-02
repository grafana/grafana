import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import { fetchAll, fetchDetails, install, uninstall, loadPluginDashboards, panelPluginLoaded } from './actions';
import { PluginListDisplayMode, RequestStatus } from '../types';
import { STATE_PREFIX } from '../constants';
export var pluginsAdapter = createEntityAdapter();
var isPendingRequest = function (action) { return new RegExp(STATE_PREFIX + "/(.*)/pending").test(action.type); };
var isFulfilledRequest = function (action) { return new RegExp(STATE_PREFIX + "/(.*)/fulfilled").test(action.type); };
var isRejectedRequest = function (action) { return new RegExp(STATE_PREFIX + "/(.*)/rejected").test(action.type); };
// Extract the trailing '/pending', '/rejected', or '/fulfilled'
var getOriginalActionType = function (type) {
    var separator = type.lastIndexOf('/');
    return type.substring(0, separator);
};
var slice = createSlice({
    name: 'plugins',
    initialState: {
        items: pluginsAdapter.getInitialState(),
        requests: {},
        settings: {
            displayMode: PluginListDisplayMode.Grid,
        },
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
    },
    reducers: {
        setDisplayMode: function (state, action) {
            state.settings.displayMode = action.payload;
        },
    },
    extraReducers: function (builder) {
        return builder
            // Fetch All
            .addCase(fetchAll.fulfilled, function (state, action) {
            pluginsAdapter.upsertMany(state.items, action.payload);
        })
            // Fetch Details
            .addCase(fetchDetails.fulfilled, function (state, action) {
            pluginsAdapter.updateOne(state.items, action.payload);
        })
            // Install
            .addCase(install.fulfilled, function (state, action) {
            pluginsAdapter.updateOne(state.items, action.payload);
        })
            // Uninstall
            .addCase(uninstall.fulfilled, function (state, action) {
            pluginsAdapter.updateOne(state.items, action.payload);
        })
            // Load a panel plugin (backward-compatibility)
            // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
            .addCase(panelPluginLoaded, function (state, action) {
            state.panels[action.payload.meta.id] = action.payload;
        })
            // Start loading panel dashboards (backward-compatibility)
            // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
            .addCase(loadPluginDashboards.pending, function (state, action) {
            state.isLoadingPluginDashboards = true;
            state.dashboards = [];
        })
            // Load panel dashboards (backward-compatibility)
            // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
            .addCase(loadPluginDashboards.fulfilled, function (state, action) {
            state.isLoadingPluginDashboards = false;
            state.dashboards = action.payload;
        })
            .addMatcher(isPendingRequest, function (state, action) {
            state.requests[getOriginalActionType(action.type)] = {
                status: RequestStatus.Pending,
            };
        })
            .addMatcher(isFulfilledRequest, function (state, action) {
            state.requests[getOriginalActionType(action.type)] = {
                status: RequestStatus.Fulfilled,
            };
        })
            .addMatcher(isRejectedRequest, function (state, action) {
            state.requests[getOriginalActionType(action.type)] = {
                status: RequestStatus.Rejected,
                error: action.payload,
            };
        });
    },
});
export var setDisplayMode = slice.actions.setDisplayMode;
export var reducer = slice.reducer;
//# sourceMappingURL=reducer.js.map