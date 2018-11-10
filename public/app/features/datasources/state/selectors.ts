import { DataSource } from '../../../types';

export const getDataSources = state => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.dataSources.filter(dataSource => {
    return regex.test(dataSource.name) || regex.test(dataSource.database);
  });
};

export const getDataSourceTypes = state => {
  const regex = new RegExp(state.dataSourceTypeSearchQuery, 'i');

  return state.dataSourceTypes.filter(type => {
    return regex.test(type.name);
  });
};

export const getDataSource = (state, dataSourceId): DataSource | null => {
  if (state.dataSource.id === parseInt(dataSourceId, 10)) {
    return state.dataSource;
  }
  return null;
};

export const getDataSourcesSearchQuery = state => state.searchQuery;
export const getDataSourcesLayoutMode = state => state.layoutMode;
export const getDataSourcesCount = state => state.dataSourcesCount;
