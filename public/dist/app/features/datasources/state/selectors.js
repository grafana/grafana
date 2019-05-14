export var getDataSources = function (state) {
    var regex = new RegExp(state.searchQuery, 'i');
    return state.dataSources.filter(function (dataSource) {
        return regex.test(dataSource.name) || regex.test(dataSource.database);
    });
};
export var getDataSourceTypes = function (state) {
    var regex = new RegExp(state.dataSourceTypeSearchQuery, 'i');
    return state.dataSourceTypes.filter(function (type) {
        return regex.test(type.name);
    });
};
export var getDataSource = function (state, dataSourceId) {
    if (state.dataSource.id === parseInt(dataSourceId, 10)) {
        return state.dataSource;
    }
    return {};
};
export var getDataSourceMeta = function (state, type) {
    if (state.dataSourceMeta.id === type) {
        return state.dataSourceMeta;
    }
    return {};
};
export var getDataSourcesSearchQuery = function (state) { return state.searchQuery; };
export var getDataSourcesLayoutMode = function (state) { return state.layoutMode; };
export var getDataSourcesCount = function (state) { return state.dataSourcesCount; };
//# sourceMappingURL=selectors.js.map