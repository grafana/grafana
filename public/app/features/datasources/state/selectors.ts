export const getDataSources = state => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.dataSources.filter(dataSource => {
    return regex.test(dataSource.name) || regex.test(dataSource.database);
  });
};

export const getDataSourcesSearchQuery = state => state.searchQuery;
export const getDataSourcesLayoutMode = state => state.layoutMode;
export const getDataSourcesCount = state => state.dataSourcesCount;
