var _a;
import { createSlice } from '@reduxjs/toolkit';
import { config } from 'app/core/config';
import { reducer as pluginCatalogReducer } from '../admin/state/reducer';
export var initialState = {
    plugins: [],
    errors: [],
    searchQuery: '',
    hasFetched: false,
    dashboards: [],
    isLoadingPluginDashboards: false,
    panels: {},
};
var pluginsSlice = createSlice({
    name: 'plugins',
    initialState: initialState,
    reducers: {
        pluginsLoaded: function (state, action) {
            state.hasFetched = true;
            state.plugins = action.payload;
        },
        pluginsErrorsLoaded: function (state, action) {
            state.errors = action.payload;
        },
        setPluginsSearchQuery: function (state, action) {
            state.searchQuery = action.payload;
        },
        pluginDashboardsLoad: function (state, action) {
            state.isLoadingPluginDashboards = true;
            state.dashboards = [];
        },
        pluginDashboardsLoaded: function (state, action) {
            state.isLoadingPluginDashboards = false;
            state.dashboards = action.payload;
        },
        panelPluginLoaded: function (state, action) {
            state.panels[action.payload.meta.id] = action.payload;
        },
    },
});
export var pluginsLoaded = (_a = pluginsSlice.actions, _a.pluginsLoaded), pluginsErrorsLoaded = _a.pluginsErrorsLoaded, pluginDashboardsLoad = _a.pluginDashboardsLoad, pluginDashboardsLoaded = _a.pluginDashboardsLoaded, setPluginsSearchQuery = _a.setPluginsSearchQuery, panelPluginLoaded = _a.panelPluginLoaded;
export var pluginsReducer = config.pluginAdminEnabled
    ? pluginCatalogReducer
    : pluginsSlice.reducer;
export default {
    plugins: pluginsReducer,
};
//# sourceMappingURL=reducers.js.map