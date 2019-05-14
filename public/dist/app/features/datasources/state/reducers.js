import * as tslib_1 from "tslib";
import { dataSourceLoaded, dataSourcesLoaded, setDataSourcesSearchQuery, setDataSourcesLayoutMode, dataSourceTypesLoad, dataSourceTypesLoaded, setDataSourceTypeSearchQuery, dataSourceMetaLoaded, setDataSourceName, setIsDefault, } from './actions';
import { LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';
import { reducerFactory } from 'app/core/redux';
export var initialState = {
    dataSources: [],
    dataSource: {},
    layoutMode: LayoutModes.List,
    searchQuery: '',
    dataSourcesCount: 0,
    dataSourceTypes: [],
    dataSourceTypeSearchQuery: '',
    hasFetched: false,
    isLoadingDataSources: false,
    dataSourceMeta: {},
};
export var dataSourcesReducer = reducerFactory(initialState)
    .addMapper({
    filter: dataSourcesLoaded,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { hasFetched: true, dataSources: action.payload, dataSourcesCount: action.payload.length })); },
})
    .addMapper({
    filter: dataSourceLoaded,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { dataSource: action.payload })); },
})
    .addMapper({
    filter: setDataSourcesSearchQuery,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { searchQuery: action.payload })); },
})
    .addMapper({
    filter: setDataSourcesLayoutMode,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { layoutMode: action.payload })); },
})
    .addMapper({
    filter: dataSourceTypesLoad,
    mapper: function (state) { return (tslib_1.__assign({}, state, { dataSourceTypes: [], isLoadingDataSources: true })); },
})
    .addMapper({
    filter: dataSourceTypesLoaded,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { dataSourceTypes: action.payload, isLoadingDataSources: false })); },
})
    .addMapper({
    filter: setDataSourceTypeSearchQuery,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { dataSourceTypeSearchQuery: action.payload })); },
})
    .addMapper({
    filter: dataSourceMetaLoaded,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { dataSourceMeta: action.payload })); },
})
    .addMapper({
    filter: setDataSourceName,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { dataSource: tslib_1.__assign({}, state.dataSource, { name: action.payload }) })); },
})
    .addMapper({
    filter: setIsDefault,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { dataSource: tslib_1.__assign({}, state.dataSource, { isDefault: action.payload }) })); },
})
    .create();
export default {
    dataSources: dataSourcesReducer,
};
//# sourceMappingURL=reducers.js.map