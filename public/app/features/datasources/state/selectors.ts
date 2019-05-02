import { DataSourceSettings, DataSourcePluginMeta } from '@grafana/ui/src/types';

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

export const getDataSource = (state, dataSourceId): DataSourceSettings | null => {
  if (state.dataSource.id === parseInt(dataSourceId, 10)) {
    return state.dataSource;
  }
  return {} as DataSourceSettings;
};

export const getDataSourceMeta = (state, type): DataSourcePluginMeta => {
  if (state.dataSourceMeta.id === type) {
    return state.dataSourceMeta;
  }

  return {} as DataSourcePluginMeta;
};

export const getDataSourcesSearchQuery = state => state.searchQuery;
export const getDataSourcesLayoutMode = state => state.layoutMode;
export const getDataSourcesCount = state => state.dataSourcesCount;
