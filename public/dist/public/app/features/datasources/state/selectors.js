export const getDataSources = (state) => {
    const regex = new RegExp(state.searchQuery, 'i');
    const filteredDataSources = state.dataSources.filter((dataSource) => {
        return regex.test(dataSource.name) || regex.test(dataSource.database) || regex.test(dataSource.type);
    });
    return filteredDataSources.sort((a, b) => state.isSortAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
};
export const getFilteredDataSourcePlugins = (state) => {
    const regex = new RegExp(state.dataSourceTypeSearchQuery, 'i');
    return state.plugins.filter((type) => {
        return regex.test(type.name);
    });
};
export const getDataSource = (state, dataSourceId) => {
    if (state.dataSource.uid === dataSourceId) {
        return state.dataSource;
    }
    return {};
};
export const getDataSourceMeta = (state, type) => {
    if (state.dataSourceMeta.id === type) {
        return state.dataSourceMeta;
    }
    return {};
};
export const getDataSourcesSearchQuery = (state) => state.searchQuery;
export const getDataSourcesLayoutMode = (state) => state.layoutMode;
export const getDataSourcesCount = (state) => state.dataSourcesCount;
export const getDataSourcesSort = (state) => state.isSortAscending;
//# sourceMappingURL=selectors.js.map