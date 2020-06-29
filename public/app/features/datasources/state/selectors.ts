import { DataSourcePluginMeta, DataSourceSettings, UrlQueryValue } from '@grafana/data';
import { DataSourcesState } from '../../../types/datasources';

export const getDataSources = (state: DataSourcesState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.dataSources.filter((dataSource: DataSourceSettings) => {
    return regex.test(dataSource.name) || regex.test(dataSource.database);
  });
};

export const getDataSourcePlugins = (state: DataSourcesState) => {
  const regex = new RegExp(state.dataSourceTypeSearchQuery, 'i');

  return state.plugins.filter((type: DataSourcePluginMeta) => {
    return regex.test(type.name);
  });
};

export const getDataSource = (state: DataSourcesState, dataSourceId: UrlQueryValue): DataSourceSettings | null => {
  if (state.dataSource.id === parseInt(dataSourceId as string, 10)) {
    return state.dataSource;
  }
  return {} as DataSourceSettings;
};

export const getDataSourceMeta = (state: DataSourcesState, type: string): DataSourcePluginMeta => {
  if (state.dataSourceMeta.id === type) {
    return state.dataSourceMeta;
  }

  return {} as DataSourcePluginMeta;
};

export const getDataSourcesSearchQuery = (state: DataSourcesState) => state.searchQuery;
export const getDataSourcesLayoutMode = (state: DataSourcesState) => state.layoutMode;
export const getDataSourcesCount = (state: DataSourcesState) => state.dataSourcesCount;
