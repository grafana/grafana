import { __assign } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import { LayoutModes } from '@grafana/data';
export var initialState = {
    dataSources: [],
    plugins: [],
    categories: [],
    dataSource: {},
    layoutMode: LayoutModes.List,
    searchQuery: '',
    dataSourcesCount: 0,
    dataSourceTypeSearchQuery: '',
    hasFetched: false,
    isLoadingDataSources: false,
    dataSourceMeta: {},
};
export var dataSourceLoaded = createAction('dataSources/dataSourceLoaded');
export var dataSourcesLoaded = createAction('dataSources/dataSourcesLoaded');
export var dataSourceMetaLoaded = createAction('dataSources/dataSourceMetaLoaded');
export var dataSourcePluginsLoad = createAction('dataSources/dataSourcePluginsLoad');
export var dataSourcePluginsLoaded = createAction('dataSources/dataSourcePluginsLoaded');
export var setDataSourcesSearchQuery = createAction('dataSources/setDataSourcesSearchQuery');
export var setDataSourcesLayoutMode = createAction('dataSources/setDataSourcesLayoutMode');
export var setDataSourceTypeSearchQuery = createAction('dataSources/setDataSourceTypeSearchQuery');
export var setDataSourceName = createAction('dataSources/setDataSourceName');
export var setIsDefault = createAction('dataSources/setIsDefault');
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export var dataSourcesReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    if (dataSourcesLoaded.match(action)) {
        return __assign(__assign({}, state), { hasFetched: true, dataSources: action.payload, dataSourcesCount: action.payload.length });
    }
    if (dataSourceLoaded.match(action)) {
        return __assign(__assign({}, state), { dataSource: action.payload });
    }
    if (setDataSourcesSearchQuery.match(action)) {
        return __assign(__assign({}, state), { searchQuery: action.payload });
    }
    if (setDataSourcesLayoutMode.match(action)) {
        return __assign(__assign({}, state), { layoutMode: action.payload });
    }
    if (dataSourcePluginsLoad.match(action)) {
        return __assign(__assign({}, state), { plugins: [], isLoadingDataSources: true });
    }
    if (dataSourcePluginsLoaded.match(action)) {
        return __assign(__assign({}, state), { plugins: action.payload.plugins, categories: action.payload.categories, isLoadingDataSources: false });
    }
    if (setDataSourceTypeSearchQuery.match(action)) {
        return __assign(__assign({}, state), { dataSourceTypeSearchQuery: action.payload });
    }
    if (dataSourceMetaLoaded.match(action)) {
        return __assign(__assign({}, state), { dataSourceMeta: action.payload });
    }
    if (setDataSourceName.match(action)) {
        return __assign(__assign({}, state), { dataSource: __assign(__assign({}, state.dataSource), { name: action.payload }) });
    }
    if (setIsDefault.match(action)) {
        return __assign(__assign({}, state), { dataSource: __assign(__assign({}, state.dataSource), { isDefault: action.payload }) });
    }
    return state;
};
export var initialDataSourceSettingsState = {
    testingStatus: {},
    loadError: null,
    loading: true,
    plugin: null,
};
export var initDataSourceSettingsSucceeded = createAction('dataSourceSettings/initDataSourceSettingsSucceeded');
export var initDataSourceSettingsFailed = createAction('dataSourceSettings/initDataSourceSettingsFailed');
export var testDataSourceStarting = createAction('dataSourceSettings/testDataSourceStarting');
export var testDataSourceSucceeded = createAction('dataSourceSettings/testDataSourceSucceeded');
export var testDataSourceFailed = createAction('dataSourceSettings/testDataSourceFailed');
export var dataSourceSettingsReducer = function (state, action) {
    var _a, _b, _c, _d, _e;
    if (state === void 0) { state = initialDataSourceSettingsState; }
    if (initDataSourceSettingsSucceeded.match(action)) {
        return __assign(__assign({}, state), { plugin: action.payload, loadError: null, loading: false });
    }
    if (initDataSourceSettingsFailed.match(action)) {
        return __assign(__assign({}, state), { plugin: null, loadError: action.payload.message, loading: false });
    }
    if (testDataSourceStarting.match(action)) {
        return __assign(__assign({}, state), { testingStatus: {
                message: 'Testing...',
                status: 'info',
            } });
    }
    if (testDataSourceSucceeded.match(action)) {
        return __assign(__assign({}, state), { testingStatus: {
                status: (_a = action.payload) === null || _a === void 0 ? void 0 : _a.status,
                message: (_b = action.payload) === null || _b === void 0 ? void 0 : _b.message,
                details: (_c = action.payload) === null || _c === void 0 ? void 0 : _c.details,
            } });
    }
    if (testDataSourceFailed.match(action)) {
        return __assign(__assign({}, state), { testingStatus: {
                status: 'error',
                message: (_d = action.payload) === null || _d === void 0 ? void 0 : _d.message,
                details: (_e = action.payload) === null || _e === void 0 ? void 0 : _e.details,
            } });
    }
    return state;
};
export default {
    dataSources: dataSourcesReducer,
    dataSourceSettings: dataSourceSettingsReducer,
};
//# sourceMappingURL=reducers.js.map