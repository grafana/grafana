import { createAction } from '@reduxjs/toolkit';
import { LayoutModes } from '@grafana/data';
export const initialState = {
    dataSources: [],
    plugins: [],
    categories: [],
    dataSource: {},
    layoutMode: LayoutModes.List,
    searchQuery: '',
    dataSourcesCount: 0,
    dataSourceTypeSearchQuery: '',
    isLoadingDataSources: false,
    isLoadingDataSourcePlugins: false,
    dataSourceMeta: {},
    isSortAscending: true,
};
export const dataSourceLoaded = createAction('dataSources/dataSourceLoaded');
export const dataSourcesLoad = createAction('dataSources/dataSourcesLoad');
export const dataSourcesLoaded = createAction('dataSources/dataSourcesLoaded');
export const dataSourceMetaLoaded = createAction('dataSources/dataSourceMetaLoaded');
export const dataSourcePluginsLoad = createAction('dataSources/dataSourcePluginsLoad');
export const dataSourcePluginsLoaded = createAction('dataSources/dataSourcePluginsLoaded');
export const setDataSourcesSearchQuery = createAction('dataSources/setDataSourcesSearchQuery');
export const setDataSourcesLayoutMode = createAction('dataSources/setDataSourcesLayoutMode');
export const setDataSourceTypeSearchQuery = createAction('dataSources/setDataSourceTypeSearchQuery');
export const setDataSourceName = createAction('dataSources/setDataSourceName');
export const setIsDefault = createAction('dataSources/setIsDefault');
export const setIsSortAscending = createAction('dataSources/setIsSortAscending');
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const dataSourcesReducer = (state = initialState, action) => {
    if (dataSourcesLoad.match(action)) {
        return Object.assign(Object.assign({}, state), { isLoadingDataSources: true });
    }
    if (dataSourcesLoaded.match(action)) {
        return Object.assign(Object.assign({}, state), { isLoadingDataSources: false, dataSources: action.payload, dataSourcesCount: action.payload.length });
    }
    if (dataSourceLoaded.match(action)) {
        return Object.assign(Object.assign({}, state), { dataSource: action.payload });
    }
    if (setDataSourcesSearchQuery.match(action)) {
        return Object.assign(Object.assign({}, state), { searchQuery: action.payload });
    }
    if (setDataSourcesLayoutMode.match(action)) {
        return Object.assign(Object.assign({}, state), { layoutMode: action.payload });
    }
    if (dataSourcePluginsLoad.match(action)) {
        return Object.assign(Object.assign({}, state), { plugins: [], isLoadingDataSourcePlugins: true });
    }
    if (dataSourcePluginsLoaded.match(action)) {
        return Object.assign(Object.assign({}, state), { plugins: action.payload.plugins, categories: action.payload.categories, isLoadingDataSourcePlugins: false });
    }
    if (setDataSourceTypeSearchQuery.match(action)) {
        return Object.assign(Object.assign({}, state), { dataSourceTypeSearchQuery: action.payload });
    }
    if (dataSourceMetaLoaded.match(action)) {
        return Object.assign(Object.assign({}, state), { dataSourceMeta: action.payload });
    }
    if (setDataSourceName.match(action)) {
        return Object.assign(Object.assign({}, state), { dataSource: Object.assign(Object.assign({}, state.dataSource), { name: action.payload }) });
    }
    if (setIsDefault.match(action)) {
        return Object.assign(Object.assign({}, state), { dataSource: Object.assign(Object.assign({}, state.dataSource), { isDefault: action.payload }) });
    }
    if (setIsSortAscending.match(action)) {
        return Object.assign(Object.assign({}, state), { isSortAscending: action.payload });
    }
    return state;
};
export const initialDataSourceSettingsState = {
    testingStatus: {},
    loadError: null,
    loading: true,
    plugin: null,
};
export const initDataSourceSettingsSucceeded = createAction('dataSourceSettings/initDataSourceSettingsSucceeded');
export const initDataSourceSettingsFailed = createAction('dataSourceSettings/initDataSourceSettingsFailed');
export const testDataSourceStarting = createAction('dataSourceSettings/testDataSourceStarting');
export const testDataSourceSucceeded = createAction('dataSourceSettings/testDataSourceSucceeded');
export const testDataSourceFailed = createAction('dataSourceSettings/testDataSourceFailed');
export const dataSourceSettingsReducer = (state = initialDataSourceSettingsState, action) => {
    var _a, _b, _c, _d, _e;
    if (initDataSourceSettingsSucceeded.match(action)) {
        return Object.assign(Object.assign({}, state), { plugin: action.payload, loadError: null, loading: false });
    }
    if (initDataSourceSettingsFailed.match(action)) {
        return Object.assign(Object.assign({}, state), { plugin: null, loadError: action.payload.message, loading: false });
    }
    if (testDataSourceStarting.match(action)) {
        return Object.assign(Object.assign({}, state), { testingStatus: {
                message: 'Testing... this could take up to a couple of minutes',
                status: 'info',
            } });
    }
    if (testDataSourceSucceeded.match(action)) {
        return Object.assign(Object.assign({}, state), { testingStatus: {
                status: (_a = action.payload) === null || _a === void 0 ? void 0 : _a.status,
                message: (_b = action.payload) === null || _b === void 0 ? void 0 : _b.message,
                details: (_c = action.payload) === null || _c === void 0 ? void 0 : _c.details,
            } });
    }
    if (testDataSourceFailed.match(action)) {
        return Object.assign(Object.assign({}, state), { testingStatus: {
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