import memoizeOne from 'memoize-one';

import { DataSourcePluginMeta, DataSourceSettings, UrlQueryValue } from '@grafana/data';
import { DataSourcesState } from 'app/types/datasources';

// Use consistent references for empty objects to prevent infinite re-renders
const EMPTY_DATASOURCE = {} as DataSourceSettings;
const EMPTY_DATASOURCE_META = {} as DataSourcePluginMeta;

export const getDataSources = memoizeOne((state: DataSourcesState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  const filteredDataSources = state.dataSources.filter((dataSource: DataSourceSettings) => {
    return regex.test(dataSource.name) || regex.test(dataSource.database) || regex.test(dataSource.type);
  });

  return filteredDataSources.sort((a, b) =>
    state.isSortAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
  );
});

export const getFilteredDataSourcePlugins = memoizeOne((state: DataSourcesState) => {
  const regex = new RegExp(state.dataSourceTypeSearchQuery, 'i');

  return state.plugins.filter((type: DataSourcePluginMeta) => {
    return regex.test(type.name);
  });
});

export const getDataSource = (state: DataSourcesState, dataSourceId: UrlQueryValue): DataSourceSettings => {
  if (state.dataSource.uid === dataSourceId) {
    return state.dataSource;
  }
  return EMPTY_DATASOURCE;
};

export const getDataSourceMeta = (state: DataSourcesState, type: string): DataSourcePluginMeta => {
  if (state.dataSourceMeta.id === type) {
    return state.dataSourceMeta;
  }

  return EMPTY_DATASOURCE_META;
};

export const getDataSourcesSearchQuery = (state: DataSourcesState) => state.searchQuery;
export const getDataSourcesLayoutMode = (state: DataSourcesState) => state.layoutMode;
export const getDataSourcesCount = (state: DataSourcesState) => state.dataSourcesCount;
export const getDataSourcesSort = (state: DataSourcesState) => state.isSortAscending;
