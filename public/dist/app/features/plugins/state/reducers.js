import * as tslib_1 from "tslib";
import { ActionTypes } from './actions';
import { LayoutModes } from '../../../core/components/LayoutSelector/LayoutSelector';
export var initialState = {
    plugins: [],
    searchQuery: '',
    layoutMode: LayoutModes.Grid,
    hasFetched: false,
    dashboards: [],
    isLoadingPluginDashboards: false,
};
export var pluginsReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    switch (action.type) {
        case ActionTypes.LoadPlugins:
            return tslib_1.__assign({}, state, { hasFetched: true, plugins: action.payload });
        case ActionTypes.SetPluginsSearchQuery:
            return tslib_1.__assign({}, state, { searchQuery: action.payload });
        case ActionTypes.SetLayoutMode:
            return tslib_1.__assign({}, state, { layoutMode: action.payload });
        case ActionTypes.LoadPluginDashboards:
            return tslib_1.__assign({}, state, { dashboards: [], isLoadingPluginDashboards: true });
        case ActionTypes.LoadedPluginDashboards:
            return tslib_1.__assign({}, state, { dashboards: action.payload, isLoadingPluginDashboards: false });
    }
    return state;
};
export default {
    plugins: pluginsReducer,
};
//# sourceMappingURL=reducers.js.map